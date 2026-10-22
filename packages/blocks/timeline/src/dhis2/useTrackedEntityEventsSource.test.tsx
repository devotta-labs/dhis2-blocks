import { CustomDataProvider } from '@dhis2/app-runtime'
import {
    focusManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useMemo, type ComponentProps, type ReactNode } from 'react'
import { renderHook } from 'vitest-browser-react'
import type { SourcePage } from '../core/types'
import { useTimelineSources } from '../core/useTimelineSources'
import manyEvents from './__fixtures__/ugly/many-events.json'
import { timelineKeys } from './timelineKeys'
import { useTrackedEntityEventsSource } from './useTrackedEntityEventsSource'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

type RawEvent = {
    event: string
    status: string
    programStage: string
    occurredAt?: string
    scheduledAt?: string
}

const completed = (event: string, occurredAt: string): RawEvent => ({
    event,
    status: 'COMPLETED',
    programStage: 's1',
    occurredAt,
})

const scheduled = (event: string, scheduledAt: string): RawEvent => ({
    event,
    status: 'SCHEDULE',
    programStage: 's1',
    scheduledAt,
})

const skipped = (
    event: string,
    scheduledAt: string,
    occurredAt?: string
): RawEvent => {
    const row: RawEvent = {
        event,
        status: 'SKIPPED',
        programStage: 's1',
        scheduledAt,
    }
    if (occurredAt !== undefined) {
        row.occurredAt = occurredAt
    }
    return row
}

const FIELDS = ['occurredAt', 'scheduledAt', 'event'] as const
type OrderField = (typeof FIELDS)[number]

const compare =
    (field: OrderField, direction: 1 | -1) => (a: RawEvent, b: RawEvent) => {
        const left = a[field]
        const right = b[field]
        if (left === right) return 0
        // Postgres: nulls first when descending, last when ascending.
        if (left === undefined) return direction === -1 ? -1 : 1
        if (right === undefined) return direction === -1 ? 1 : -1
        return (left < right ? -1 : 1) * direction
    }

/** Orders by `field:dir,field:dir`, the way the server reads `order`. */
const byOrder = (order: string) => {
    const keys = order.split(',').flatMap((part) => {
        const [name, direction] = part.split(':')
        const field = FIELDS.find((known) => known === name)
        return field === undefined
            ? []
            : [compare(field, direction === 'asc' ? 1 : -1)]
    })
    return (a: RawEvent, b: RawEvent) => {
        for (const key of keys) {
            const result = key(a, b)
            if (result !== 0) return result
        }
        return 0
    }
}

/** A fake tracker/events endpoint: status filter, ordering, paging. */
const setup = (stored: RawEvent[], failing = { on: false }) => {
    const requests: Array<{ status?: string }> = []
    const data: CustomData = {
        'tracker/events': async (_type, query) => {
            if (failing.on) {
                throw new Error('down')
            }
            const params = query.params ?? {}
            const status =
                params.status === undefined ? undefined : String(params.status)
            requests.push({ status })
            const rows = stored
                .filter((e) => status === undefined || e.status === status)
                .sort(byOrder(String(params.order)))
            const pageSize = Number(params.pageSize)
            const page = Number(params.page)
            return {
                events: rows.slice((page - 1) * pageSize, page * pageSize),
            }
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
    return { requests, queryClient, wrapper }
}

const now = new Date(2026, 9, 22, 12, 0, 0)
const subject = {
    trackedEntity: 'te1',
    program: 'prog1',
    timeField: 'occurredAt',
    now,
} as const

const render = (
    wrapper: ReturnType<typeof setup>['wrapper'],
    options: { pageSize?: number; scheduledCap?: number } = {}
) =>
    renderHook(() => useTrackedEntityEventsSource({ ...subject, ...options }), {
        wrapper,
    })

const signal = () => new AbortController().signal

const page = async (
    source: ReturnType<typeof useTrackedEntityEventsSource>,
    cursor?: SourcePage<unknown>['nextCursor']
) => {
    const result = await source.fetchPage(cursor, signal())
    if (Result.isError(result)) throw new Error(JSON.stringify(result.error))
    return result.value
}

describe('useTrackedEntityEventsSource', () => {
    const stored = [
        scheduled('future1', '2027-01-15T00:00:00.000'),
        scheduled('late1', '2026-08-01T00:00:00.000'),
        skipped('skip1', '2026-04-20T00:00:00.000'),
        completed('c1', '2026-05-05T00:00:00.000'),
        completed('c2', '2026-05-04T00:00:00.000'),
        completed('c3', '2026-05-03T00:00:00.000'),
        completed('c4', '2026-05-02T00:00:00.000'),
    ]

    it('returns pinned and first past page together, then past pages only', async () => {
        const { wrapper, requests } = setup(stored)
        const { result } = await render(wrapper, { pageSize: 5 })
        expect(result.current.key).toBe('events')

        const first = await page(result.current)

        expect(first.entries.map((e) => [e.id, e.phase]).sort()).toEqual([
            ['events:c1', 'past'],
            ['events:c2', 'past'],
            ['events:future1', 'future'],
            ['events:late1', 'overdue'],
            ['events:skip1', 'past'],
        ])
        expect(first.nextCursor).toBeDefined()
        expect(requests.some((r) => r.status === 'SCHEDULE')).toBe(true)

        requests.length = 0
        const second = await page(result.current, first.nextCursor)

        expect(second.entries.map((e) => e.id)).toEqual([
            'events:c3',
            'events:c4',
        ])
        expect(requests.every((r) => r.status === undefined)).toBe(true)
        expect(requests).toHaveLength(1)
    })

    it('sets completeUntil to the last raw row of a full page and stops on a short page', async () => {
        const { wrapper } = setup(stored)
        const { result } = await render(wrapper, { pageSize: 5 })

        const first = await page(result.current)
        const second = await page(result.current, first.nextCursor)

        // The last raw row on page 1 is c2.
        expect(first.completeUntil).toBe('2026-05-04T00:00:00.000')
        expect(second.nextCursor).toBeUndefined()
        expect(second.completeUntil).toBeUndefined()
    })

    it('returns no entries but a cursor and completeUntil when a full page is all filtered out', async () => {
        const { wrapper } = setup([
            skipped('skip1', '2026-04-20T00:00:00.000', '2026-03-01'),
            completed('c1', '2026-02-01'),
        ])
        const { result } = await render(wrapper, { pageSize: 1 })

        const first = await page(result.current)

        // Only the pinned skipped entry; no past entry came from the raw page.
        expect(first.entries.map((e) => e.id)).toEqual(['events:skip1'])
        expect(first.nextCursor).toBeDefined()
        expect(first.completeUntil).toBe('2026-03-01')

        const second = await page(result.current, first.nextCursor)
        expect(second.entries.map((e) => e.id)).toEqual(['events:c1'])
        // A full page can't say it was the last.
        expect(second.nextCursor).toBeDefined()
    })

    it('shows no more than scheduledCap pinned events and keeps saying so on every page', async () => {
        const { wrapper } = setup([
            scheduled('f1', '2027-01-01'),
            scheduled('f2', '2027-02-01'),
            scheduled('f3', '2027-03-01'),
            completed('c1', '2026-05-05'),
            completed('c2', '2026-05-04'),
            completed('c3', '2026-05-03'),
        ])
        const { result } = await render(wrapper, {
            pageSize: 2,
            scheduledCap: 2,
        })

        const first = await page(result.current)
        const second = await page(result.current, first.nextCursor)
        const third = await page(result.current, second.nextCursor)

        expect(
            first.entries.filter((e) => e.phase === 'future').map((e) => e.id)
        ).toEqual(['events:f1', 'events:f2'])
        expect(first.notice).toBe("More scheduled events aren't shown.")
        // The events are still hidden after load-more, and the merge
        // replaces a source's notice with each page's.
        expect(second.notice).toBe("More scheduled events aren't shown.")
        expect(third.notice).toBe("More scheduled events aren't shown.")
        expect(third.entries.map((e) => e.id)).toEqual([
            'events:c2',
            'events:c3',
        ])
    })

    it('has no notice when every scheduled event fits', async () => {
        const { wrapper } = setup(stored)
        const { result } = await render(wrapper, { pageSize: 5 })

        expect((await page(result.current)).notice).toBeUndefined()
    })

    it('reports a failed request as a failed source error', async () => {
        const data: CustomData = {
            'tracker/events': async () => {
                throw new Error('boom')
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
        const { result } = await render(wrapper)

        const answer = await result.current.fetchPage(undefined, signal())

        expect(Result.isError(answer) && answer.error.kind).toBe('failed')
        const later = await result.current.fetchPage(
            { page: 2, capped: false },
            signal()
        )
        expect(Result.isError(later) && later.error.kind).toBe('failed')
    })

    it('renders 500 events across 10 pages with load-more appending only', async () => {
        const { wrapper } = setup(manyEvents.events)
        const { result } = await renderHook(
            () => {
                const source = useTrackedEntityEventsSource({
                    ...subject,
                    pageSize: 50,
                })
                return useTimelineSources([source])
            },
            { wrapper }
        )

        await expect.poll(() => result.current.status).toBe('ready')
        let previous = result.current.entries.map((e) => e.id)
        expect(previous).toHaveLength(50)
        while (result.current.entries.length < 500) {
            const before = previous.length
            result.current.loadMore()
            await expect
                .poll(() => result.current.entries.length)
                .toBeGreaterThan(before)
            const next = result.current.entries.map((e) => e.id)
            expect(next.slice(0, before)).toEqual(previous)
            previous = next
        }

        // The tenth page was full, so one more request finds the end.
        expect(result.current.hasMore).toBe(true)
        result.current.loadMore()
        await expect.poll(() => result.current.hasMore).toBe(false)
        expect(result.current.entries.map((e) => e.id)).toEqual(previous)
        expect(previous).toHaveLength(500)
        expect(new Set(previous).size).toBe(500)
    })

    it('changes revision after timelineKeys.root is invalidated', async () => {
        const { wrapper, queryClient } = setup(stored)
        const { result } = await render(wrapper, { pageSize: 5 })
        await new Promise((resolve) => setTimeout(resolve, 100))
        const before = result.current.revision

        await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

        await expect.poll(() => result.current.revision).not.toBe(before)
    })

    describe('in a feed', () => {
        /** The source in a feed, counting how often it is started over. */
        const renderFeed = (
            wrapper: ReturnType<typeof setup>['wrapper'],
            pageSize: number
        ) => {
            const starts = { count: 0 }
            const rendered = renderHook(
                () => {
                    const source = useTrackedEntityEventsSource({
                        ...subject,
                        pageSize,
                    })
                    const counted = useMemo(
                        (): typeof source => ({
                            ...source,
                            fetchPage: (cursor, abort) => {
                                if (cursor === undefined) {
                                    starts.count += 1
                                }
                                return source.fetchPage(cursor, abort)
                            },
                        }),
                        [source]
                    )
                    return useTimelineSources([counted])
                },
                { wrapper }
            )
            return { starts, rendered }
        }

        const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

        it('does not restart the source when its first page first settles', async () => {
            const { wrapper } = setup(stored)
            const { starts, rendered } = renderFeed(wrapper, 5)
            const { result } = await rendered

            await expect.poll(() => result.current.status).toBe('ready')
            await settle()

            expect(starts.count).toBe(1)
            expect(result.current.entries.length).toBeGreaterThan(0)
        })

        it('does not restart the source on window focus or reconnect', async () => {
            const { wrapper, requests } = setup(stored)
            const { starts, rendered } = renderFeed(wrapper, 5)
            const { result } = await rendered
            await expect.poll(() => result.current.status).toBe('ready')
            await settle()
            const asked = requests.length

            focusManager.setFocused(false)
            focusManager.setFocused(true)
            window.dispatchEvent(new Event('online'))
            await settle()
            focusManager.setFocused(undefined)

            expect(starts.count).toBe(1)
            expect(requests).toHaveLength(asked)
        })

        it('restarts the source when timelineKeys.root is invalidated', async () => {
            const { wrapper, queryClient } = setup(stored)
            const { starts, rendered } = renderFeed(wrapper, 5)
            const { result } = await rendered
            await expect.poll(() => result.current.status).toBe('ready')
            await settle()

            await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

            await expect.poll(() => starts.count).toBe(2)
        })

        it('restarts after a failed first page once an invalidation succeeds', async () => {
            const failing = { on: true }
            const { wrapper, queryClient } = setup(stored, failing)
            const { rendered } = renderFeed(wrapper, 5)
            const { result } = await rendered
            await expect
                .poll(() => result.current.sources[0]?.status)
                .toBe('error')

            failing.on = false
            await queryClient.invalidateQueries({ queryKey: timelineKeys.root })

            await expect
                .poll(() => result.current.entries.length)
                .toBeGreaterThan(0)
            expect(result.current.sources[0]?.status).toBe('hasMore')
        })

        it('only appends when load-more crosses a run of events with the same time', async () => {
            const tied = ['t1', 't2', 't3', 't4'].map((id) =>
                completed(id, '2026-05-05T00:00:00.000')
            )
            const { wrapper } = setup([
                ...tied,
                completed('o1', '2026-05-01T00:00:00.000'),
                completed('o2', '2026-04-01T00:00:00.000'),
            ])
            const { rendered } = renderFeed(wrapper, 3)
            const { result } = await rendered
            await expect.poll(() => result.current.status).toBe('ready')
            const first = result.current.entries.map((e) => e.id)
            expect(first.length).toBeGreaterThan(0)

            result.current.loadMore()
            await expect
                .poll(() => result.current.entries.length)
                .toBeGreaterThan(first.length)

            const next = result.current.entries.map((e) => e.id)
            expect(next.slice(0, first.length)).toEqual(first)
            expect(next.slice(0, 4)).toEqual([
                'events:t1',
                'events:t2',
                'events:t3',
                'events:t4',
            ])
        })
    })
})
