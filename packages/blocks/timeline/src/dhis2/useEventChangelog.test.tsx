import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import v43 from './__fixtures__/v43/event-changelog.json'
import { useEventChangelog } from './useEventChangelog'
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
    const queryClient = new QueryClient()
    const wrapper = ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
    return { requests, wrapper }
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
        expect(result.current).toEqual({
            status: 'idle',
            groups: [],
            truncated: false,
        })

        await rerender({ enabled: true })

        await expect.poll(() => result.current.status).toBe('success')
        expect(requests[0]).toMatchObject({ order: 'createdAt:desc', page: 1 })
        expect(
            result.current.groups.map((group) =>
                group.changes.map((change) => [change.field.id, change.type])
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
        expect(result.current.groups[0]?.user.displayName).toBe('John Traore')
        expect(result.current.truncated).toBe(false)
    })

    it('reports unsupported when the endpoint answers 404', async () => {
        const { wrapper } = setup(
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

        await expect.poll(() => result.current.status).toBe('unsupported')
        expect(result.current.groups).toEqual([])
    })

    it('reports other failures as an error', async () => {
        const { wrapper } = setup(
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

        await expect.poll(() => result.current.status).toBe('error')
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

        await expect.poll(() => result.current.status).toBe('success')
        expect(result.current.truncated).toBe(true)
        expect(
            result.current.groups.flatMap((group) => group.changes)
        ).toHaveLength(500)
        expect(requests.map((r) => r.page)).toEqual(
            requests.map((_, i) => i + 1)
        )
    })
})
