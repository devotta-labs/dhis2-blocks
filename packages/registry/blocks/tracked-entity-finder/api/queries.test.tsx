import { CustomDataProvider, FetchError, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z, ZodError } from 'zod'
import { hivProgram } from '../__tests__/fixtures/program'
import { buildProgramModel } from '../rules/programModel'
import type { ValidatedSearch } from '../rules/types'
import {
    shouldRetryRequest,
    useProgramMetadata,
    useSearchPages,
    useSystemInfo,
} from './queries'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
})
type Request = z.infer<typeof RequestSchema>

const BodySchema = z.json()
type Respond = (request: Request) => Promise<z.infer<typeof BodySchema>>

interface Server {
    programs?: Respond
    systemInfo?: Respond
    search?: Respond
}

const SERVER = 'https://dhis2.test'
const THREE_HOURS = 3 * 60 * 60_000
const FIVE_MINUTES = 5 * 60_000

const failure = (httpStatusCode: number, message = `HTTP ${httpStatusCode}`) =>
    new FetchError({
        type: 'unknown',
        message,
        details: { httpStatusCode },
    })

/** A 409 as app-runtime throws it: no access, with the server's body as details. */
const conflict = (message: string, serverMessage?: string) =>
    new FetchError({
        type: 'access',
        message,
        details: { httpStatusCode: 409, message: serverMessage },
    })

const programBody = (minAttributesRequiredToSearch: number) => ({
    displayName: 'HIV',
    trackedEntityType: { id: 'tet' },
    minAttributesRequiredToSearch,
    programTrackedEntityAttributes: [],
})

const person = (id: string) => ({
    trackedEntity: id,
    trackedEntityType: 'personType',
    orgUnit: 'ouA',
})

const setup = ({
    programs = async () => programBody(1),
    systemInfo = async () => ({
        calendar: 'gregorian',
        dateFormat: 'YYYY-MM-DD',
        version: '2.43.1',
    }),
    search = async () => ({ trackedEntities: [], pager: { total: 0 } }),
}: Server = {}) => {
    const requests: Request[] = []
    const answer = (request: Request, respond: Respond) => {
        requests.push(request)
        return respond(request)
    }
    const data: CustomData = {
        programs: async (_type, query) =>
            answer(RequestSchema.parse(query), programs),
        'system/info': async (_type, query) =>
            answer(RequestSchema.parse(query), systemInfo),
        'tracker/trackedEntities': async (_type, query) =>
            answer(RequestSchema.parse(query), search),
    }
    // Failures retry as in a host, without the wait between tries.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    /** The same QueryClient and resources, behind the server at `baseUrl`. */
    const wrapperFor =
        (baseUrl: string) =>
        ({ children }: { children: ReactNode }) => (
            <QueryClientProvider client={queryClient}>
                <Provider
                    config={{ baseUrl, apiVersion: 43 }}
                    userInfo={undefined}
                    plugin={false}
                    parentAlertsAdd={undefined}
                    showAlertsInPlugin={false}
                >
                    <CustomDataProvider data={data}>
                        {children}
                    </CustomDataProvider>
                </Provider>
            </QueryClientProvider>
        )
    /** What the finder holds in the cache: each entry's key and how long it is kept. */
    const cached = () =>
        queryClient
            .getQueryCache()
            .getAll()
            .map(({ queryKey, gcTime }) => ({ queryKey, gcTime }))
    return {
        wrapper: wrapperFor(SERVER),
        wrapperFor,
        requests,
        cached,
    }
}

/** Lets a refetch on mount go out, if there is one. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

describe('shouldRetryRequest', () => {
    it.each([
        { name: 'a server error', error: failure(500), retried: true },
        { name: 'a client error', error: failure(400), retried: false },
        {
            name: 'a network failure',
            error: new FetchError({
                type: 'network',
                message: 'offline',
                details: {},
            }),
            retried: true,
        },
        { name: 'a conflict', error: conflict('Conflict'), retried: false },
        {
            name: 'a malformed response',
            error: new ZodError([]),
            retried: false,
        },
        {
            name: 'an aborted request',
            error: new DOMException('Aborted', 'AbortError'),
            retried: false,
        },
    ])('$name: retried is $retried', ({ error, retried }) => {
        expect(shouldRetryRequest(0, error)).toBe(retried)
        expect(shouldRetryRequest(1, error)).toBe(retried)
        expect(shouldRetryRequest(2, error)).toBe(false)
    })
})

describe('useProgramMetadata', () => {
    it('requests the program fields the rules need', async () => {
        const { wrapper, requests } = setup()

        const { result } = await renderHook(() => useProgramMetadata('prog'), {
            wrapper,
        })

        await expect
            .poll(() => result.current.data)
            .toMatchObject({ program: 'prog', name: 'HIV' })
        expect(requests).toHaveLength(1)
        expect(requests[0]).toMatchObject({ resource: 'programs', id: 'prog' })
        const fields = requests[0].params?.fields
        expect(fields).toContain('minAttributesRequiredToSearch')
        expect(fields).toContain('maxTeiCountToReturn')
        expect(fields).toContain(
            'programTrackedEntityAttributes[searchable,displayInList,sortOrder,preferredSearchOperator,blockedSearchOperators,minCharactersToSearch,'
        )
        expect(fields).toContain('blockedSearchOperators')
    })

    it('reuses program rules for three hours, then reloads them', async () => {
        let minimum = 1
        const { wrapper, requests, cached } = setup({
            programs: async () => programBody(minimum),
        })
        const mount = () =>
            renderHook(() => useProgramMetadata('prog'), { wrapper })
        const rules = (hook: Awaited<ReturnType<typeof mount>>) =>
            hook.result.current.data?.minAttributesRequiredToSearch
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            const first = await mount()
            await expect.poll(() => rules(first)).toBe(1)
            // Kept while no finder is mounted, for as long as it is fresh.
            expect(cached()).toEqual([
                {
                    queryKey: [
                        'tracked-entity-finder',
                        'program',
                        SERVER,
                        'prog',
                    ],
                    gcTime: THREE_HOURS,
                },
            ])
            await first.unmount()

            minimum = 2
            clock.mockReturnValue(now + THREE_HOURS - 1)
            const second = await mount()
            expect(rules(second)).toBe(1)
            await settle()
            expect(rules(second)).toBe(1)
            expect(requests).toHaveLength(1)
            await second.unmount()

            clock.mockReturnValue(now + THREE_HOURS)
            const third = await mount()
            await expect.poll(() => rules(third)).toBe(2)
            expect(requests).toHaveLength(2)
        } finally {
            clock.mockRestore()
        }
    })

    it('never shares program rules between two servers', async () => {
        const { wrapper, wrapperFor, requests } = setup()
        const here = await renderHook(() => useProgramMetadata('prog'), {
            wrapper,
        })
        await expect.poll(() => here.result.current.isSuccess).toBe(true)

        const there = await renderHook(() => useProgramMetadata('prog'), {
            wrapper: wrapperFor('https://other.dhis2.test'),
        })
        expect(there.result.current.data).toBeUndefined()
        await expect.poll(() => there.result.current.isSuccess).toBe(true)
        expect(requests).toHaveLength(2)
    })
})

describe('useSystemInfo', () => {
    it('reads the calendar, the date format and what the version searches', async () => {
        const { wrapper, requests } = setup({
            systemInfo: async () => ({
                calendar: 'ethiopian',
                dateFormat: 'dd-MM-yyyy',
                version: '2.42.3',
            }),
        })

        const { result } = await renderHook(() => useSystemInfo(), { wrapper })

        await expect
            .poll(() => result.current.data)
            .toEqual({
                calendar: 'ethiopian',
                dateFormat: 'DD-MM-YYYY',
                multiTextSearch: false,
            })
        expect(requests).toEqual([
            {
                resource: 'system/info',
                params: { fields: 'calendar,dateFormat,version' },
            },
        ])
    })

    it('reuses system info for three hours, then reloads it', async () => {
        let calendar = 'gregorian'
        const { wrapper, requests, cached } = setup({
            systemInfo: async () => ({
                calendar,
                dateFormat: 'yyyy-MM-dd',
                version: '2.43.0',
            }),
        })
        const mount = () => renderHook(() => useSystemInfo(), { wrapper })
        const shown = (hook: Awaited<ReturnType<typeof mount>>) =>
            hook.result.current.data?.calendar
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            const first = await mount()
            await expect.poll(() => shown(first)).toBe('gregorian')
            expect(cached()).toEqual([
                {
                    queryKey: ['tracked-entity-finder', 'system-info', SERVER],
                    gcTime: THREE_HOURS,
                },
            ])
            await first.unmount()

            calendar = 'ethiopian'
            clock.mockReturnValue(now + THREE_HOURS - 1)
            const second = await mount()
            await settle()
            expect(shown(second)).toBe('gregorian')
            expect(requests).toHaveLength(1)
            await second.unmount()

            clock.mockReturnValue(now + THREE_HOURS)
            const third = await mount()
            await expect.poll(() => shown(third)).toBe('ethiopian')
            expect(requests).toHaveLength(2)
        } finally {
            clock.mockRestore()
        }
    })
})

describe('useSearchPages', () => {
    const model = buildProgramModel(hivProgram)
    const searchFor = (value: string): ValidatedSearch => ({
        filters: [
            { attribute: 'artNumber', conditions: [{ op: 'eq', value }] },
        ],
    })
    const byNumberAndName: ValidatedSearch = {
        filters: [
            {
                attribute: 'artNumber',
                conditions: [{ op: 'eq', value: 'A1' }],
            },
            {
                attribute: 'firstName',
                conditions: [{ op: 'like', value: 'Amina' }],
            },
        ],
    }

    it('keys a search by server, program and filters in any order', async () => {
        const { wrapper, wrapperFor, requests, cached } = setup()
        const run = async (
            search: ValidatedSearch,
            program = model,
            server = wrapper
        ) => {
            const hook = await renderHook(
                () => useSearchPages(program, search),
                { wrapper: server }
            )
            await expect.poll(() => hook.result.current.isSuccess).toBe(true)
            await hook.unmount()
        }

        await run(byNumberAndName)
        expect(cached()).toEqual([
            {
                queryKey: [
                    'tracked-entity-finder',
                    'search',
                    SERVER,
                    'hivProgram',
                    ['artNumber:eq:A1', 'firstName:like:Amina'],
                ],
                gcTime: FIVE_MINUTES,
            },
        ])
        // The same details, filled in the other order, are the same search.
        await run({ filters: [...byNumberAndName.filters].reverse() })
        expect(requests).toHaveLength(1)

        await run(searchFor('A1'))
        expect(requests).toHaveLength(2)
        await run(byNumberAndName, { ...model, program: 'otherProgram' })
        expect(requests).toHaveLength(3)
        await run(
            byNumberAndName,
            model,
            wrapperFor('https://other.dhis2.test')
        )
        expect(requests).toHaveLength(4)
        expect(cached()).toHaveLength(4)
    })

    it('reuses results for five minutes, then reloads them', async () => {
        const { wrapper, requests } = setup()
        const mount = async () => {
            const hook = await renderHook(
                () => useSearchPages(model, searchFor('A1')),
                { wrapper }
            )
            await expect.poll(() => hook.result.current.isSuccess).toBe(true)
            await settle()
            await hook.unmount()
        }
        const now = Date.now()
        const clock = vi.spyOn(Date, 'now').mockReturnValue(now)
        try {
            await mount()
            clock.mockReturnValue(now + FIVE_MINUTES - 1)
            await mount()
            expect(requests).toHaveLength(1)
            clock.mockReturnValue(now + FIVE_MINUTES)
            await mount()
            expect(requests).toHaveLength(2)
        } finally {
            clock.mockRestore()
        }
    })

    it('asks nothing until a search is submitted', async () => {
        const { wrapper, requests } = setup()

        const { result } = await renderHook(
            () => useSearchPages(model, undefined),
            { wrapper }
        )

        expect(result.current.fetchStatus).toBe('idle')
        expect(requests).toHaveLength(0)
    })

    it.each([
        {
            name: "the server's message",
            error: conflict('Request failed', 'maxTeiCountReached: too many'),
        },
        { name: "the error's own", error: conflict('MaxTeiCountReached') },
    ])(
        'reads a 409 maxteicountreached in $name as too many matches',
        async ({ error }) => {
            const { wrapper } = setup({ search: () => Promise.reject(error) })

            const { result } = await renderHook(
                () => useSearchPages(model, searchFor('A1')),
                { wrapper }
            )

            await expect
                .poll(() => result.current.data?.pages)
                .toEqual([{ kind: 'too-many' }])
        }
    )

    it('fails on any other conflict, without asking again', async () => {
        const { wrapper, requests } = setup({
            search: () => Promise.reject(conflict('Conflict')),
        })

        const { result } = await renderHook(
            () => useSearchPages(model, searchFor('A1')),
            { wrapper }
        )

        await expect.poll(() => result.current.error?.message).toBe('Conflict')
        expect(requests).toHaveLength(1)
    })

    it('fails on a server error after asking three times', async () => {
        const { wrapper, requests } = setup({
            search: () => Promise.reject(failure(500, 'maxTeiCountReached')),
        })

        const { result } = await renderHook(
            () => useSearchPages(model, searchFor('A1')),
            { wrapper }
        )

        await expect.poll(() => result.current.isError).toBe(true)
        expect(requests).toHaveLength(3)
    })

    it("never shows a replaced search's late conflict", async () => {
        let failFirst = (_error: Error) => {}
        const { wrapper, requests } = setup({
            search: ({ params }) =>
                z.string().array().parse(params?.filter)[0].endsWith('A1')
                    ? new Promise((_resolve, reject) => {
                          failFirst = reject
                      })
                    : Promise.resolve({
                          trackedEntities: [person('te1')],
                          pager: { total: 1 },
                      }),
        })
        const { result, rerender } = await renderHook(
            (search?: ValidatedSearch) => useSearchPages(model, search),
            { wrapper, initialProps: searchFor('A1') }
        )
        await expect.poll(() => requests).toHaveLength(1)

        await rerender(searchFor('B2'))
        await expect
            .poll(() => result.current.data?.pages)
            .toMatchObject([{ kind: 'results', page: 1, hasNext: false }])

        failFirst(conflict('maxTeiCountReached'))
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(result.current.data?.pages).toMatchObject([{ kind: 'results' }])
    })
})
