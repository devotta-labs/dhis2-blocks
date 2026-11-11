import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import { z, ZodError } from 'zod'
import { hivProgram } from '../__tests__/fixtures/program'
import type { FinderSubmission } from '../provider/context'
import { buildProgramModel } from '../rules/programModel'
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
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { wrapper, requests }
}

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

    it('reloads program rules after their freshness window expires', async () => {
        let minimum = 1
        const { wrapper, requests } = setup({
            programs: async () => programBody(minimum),
        })
        const mount = () =>
            renderHook(() => useProgramMetadata('prog'), { wrapper })
        const rules = (hook: Awaited<ReturnType<typeof mount>>) =>
            hook.result.current.data?.minAttributesRequiredToSearch

        const first = await mount()
        await expect.poll(() => rules(first)).toBe(1)
        await first.unmount()

        minimum = 2
        const second = await mount()
        expect(rules(second)).toBe(1)
        await second.unmount()
        expect(requests).toHaveLength(1)

        const now = Date.now.bind(Date)
        const clock = vi
            .spyOn(Date, 'now')
            .mockImplementation(() => now() + 60 * 60_000 + 1)
        try {
            const third = await mount()
            await expect.poll(() => rules(third)).toBe(2)
            expect(requests).toHaveLength(2)
        } finally {
            clock.mockRestore()
        }
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
})

describe('useSearchPages', () => {
    const model = buildProgramModel(hivProgram)
    const submit = (value: string, submittedAt: number): FinderSubmission => ({
        search: {
            filters: [
                { attribute: 'artNumber', conditions: [{ op: 'eq', value }] },
            ],
        },
        submittedAt,
        page: 1,
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
                () => useSearchPages(model, submit('A1', 1)),
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
            () => useSearchPages(model, submit('A1', 1)),
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
            () => useSearchPages(model, submit('A1', 1)),
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
            (submission?: FinderSubmission) =>
                useSearchPages(model, submission),
            { wrapper, initialProps: submit('A1', 1) }
        )
        await expect.poll(() => requests).toHaveLength(1)

        await rerender(submit('B2', 2))
        await expect
            .poll(() => result.current.data?.pages)
            .toMatchObject([{ kind: 'results', page: 1, hasNext: false }])

        failFirst(conflict('maxTeiCountReached'))
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(result.current.data?.pages).toMatchObject([{ kind: 'results' }])
    })
})
