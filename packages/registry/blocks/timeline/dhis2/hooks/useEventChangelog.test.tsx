import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import {
    QueryClient,
    QueryClientProvider,
    type UseQueryResult,
} from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import v43 from '../__tests__/fixtures/v43/event-changelog.json'
import { useEventChangelog, type EventChangelog } from './useEventChangelog'
import { z } from 'zod'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

const EVENT = 'TlE2eEvt004'
const RESOURCE = `tracker/events/${EVENT}/changeLogs`

/** Recorded or generated rows, as the JSON the engine passes on. */
const ChangeLogsSchema = z.object({ changeLogs: z.array(z.json()) })

type Body = z.infer<typeof ChangeLogsSchema> | Error

type Respond = (params: { page: number; pageSize: number }) => Body

const setup = (respond: Respond) => {
    const requests: Array<{ page: number; order: string }> = []
    const data: CustomData = {
        [RESOURCE]: async (_type, query) => {
            const params = query.params ?? {}
            const page = Number(params.page)
            requests.push({ page, order: String(params.order) })
            await new Promise((resolve) => setTimeout(resolve, 5))
            const body = respond({ page, pageSize: Number(params.pageSize) })
            if (body instanceof Error) throw body
            return body
        },
    }
    // Failures retry, as in a host; without the wait between tries.
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
    return { requests, wrapper }
}

/** The changelog, once it has answered. */
const loaded = async (result: {
    current: UseQueryResult<EventChangelog>
}): Promise<EventChangelog> => {
    await expect.poll(() => result.current.data).toBeDefined()
    if (result.current.data === undefined) {
        throw new Error('no changelog')
    }
    return result.current.data
}

/** A distinct data value change per row, one millisecond apart, newest first. */
const generatedRow = (index: number) => ({
    change: {
        dataValue: {
            dataElement: `de${index}`,
            currentValue: String(index),
        },
    },
    createdAt: new Date(Date.UTC(2026, 9, 22, 12) - index)
        .toISOString()
        .slice(0, 23),
    createdBy: { username: 'admin' },
    type: 'CREATE',
})

describe('useEventChangelog', () => {
    it('makes no request until enabled', async () => {
        const { wrapper, requests } = setup(({ page }) =>
            page === 1 ? ChangeLogsSchema.parse(v43) : { changeLogs: [] }
        )
        const { result, rerender } = await renderHook(
            (props?: { enabled: boolean }) =>
                useEventChangelog(EVENT, { enabled: props?.enabled ?? false }),
            { wrapper, initialProps: { enabled: false } }
        )

        await new Promise((resolve) => setTimeout(resolve, 30))
        expect(requests).toHaveLength(0)
        expect(result.current.data).toBeUndefined()

        await rerender({ enabled: true })

        const changelog = await loaded(result)
        expect(requests[0]).toMatchObject({ order: 'createdAt:desc', page: 1 })
        expect(
            changelog.saves.map((save) =>
                save.changes.map((change) => [change.field.id, change.type])
            )
        ).toEqual([
            [['dyYdfamSY2Z', 'DELETE']],
            [
                ['dyYdfamSY2Z', 'CREATE'],
                ['roKuXYfw1BW', 'UPDATE'],
            ],
            [
                ['roKuXYfw1BW', 'CREATE'],
                ['scheduledAt', 'CREATE'],
                ['occurredAt', 'CREATE'],
            ],
        ])
        expect(changelog.saves[0]?.user.displayName).toBe('John Traore')
        // Event fields are labelled; data elements need the stage.
        expect(changelog.saves[2]?.changes[1]?.name).toBe('Due date')
        expect(changelog.saves[2]?.changes[0]?.name).toBe('roKuXYfw1BW')
        expect(changelog).toMatchObject({
            truncated: false,
            unsupported: false,
        })
    })

    it('reports unsupported when the endpoint answers 404, without retrying', async () => {
        const { wrapper, requests } = setup(
            () =>
                new FetchError({
                    type: 'unknown',
                    message: 'An unknown error occurred - Not Found (404)',
                    details: { httpStatusCode: 404 },
                })
        )
        const { result } = await renderHook(
            () => useEventChangelog(EVENT, { enabled: true }),
            { wrapper }
        )

        expect(await loaded(result)).toEqual({
            saves: [],
            truncated: false,
            unsupported: true,
        })
        expect(requests).toHaveLength(1)
    })

    it('reports other failures as an error, without retrying', async () => {
        const { wrapper, requests } = setup(
            () =>
                new FetchError({
                    type: 'network',
                    message: 'An unknown network error occurred',
                    details: {},
                })
        )
        const { result } = await renderHook(
            () => useEventChangelog(EVENT, { enabled: true }),
            { wrapper }
        )

        await expect.poll(() => result.current.isError).toBe(true)
        expect(result.current.data).toBeUndefined()
        expect(requests).toHaveLength(1)
    })

    it('labels data elements from the stage it is given', async () => {
        const { wrapper } = setup(() => ChangeLogsSchema.parse(v43))
        const stage = {
            id: 's1',
            name: 'Visit',
            hideDueDate: false,
            reportDataElementIds: [],
            dataElements: new Map([
                [
                    'roKuXYfw1BW',
                    { name: 'Weight', meta: { valueType: 'NUMBER' } },
                ],
            ]),
        }
        const { result } = await renderHook(
            () => useEventChangelog(EVENT, { enabled: true, stage }),
            { wrapper }
        )

        const { saves } = await loaded(result)
        expect(saves[1]?.changes.map((change) => change.name)).toEqual([
            'dyYdfamSY2Z',
            'Weight',
        ])
    })

    it('stops at 500 rows and reports truncated', async () => {
        // Always a full page: the server has more than 500 rows.
        const { wrapper, requests } = setup(({ page, pageSize }) =>
            ChangeLogsSchema.parse({
                changeLogs: Array.from({ length: pageSize }, (_, i) =>
                    generatedRow((page - 1) * pageSize + i)
                ),
            })
        )
        const { result } = await renderHook(
            () => useEventChangelog(EVENT, { enabled: true }),
            { wrapper }
        )

        const changelog = await loaded(result)
        expect(changelog.truncated).toBe(true)
        expect(changelog.saves.flatMap((save) => save.changes)).toHaveLength(
            500
        )
        expect(requests.map((r) => r.page)).toEqual(
            requests.map((_, i) => i + 1)
        )
    })
})
