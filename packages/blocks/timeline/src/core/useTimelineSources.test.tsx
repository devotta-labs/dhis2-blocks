import { Result } from 'better-result'
import { renderHook } from 'vitest-browser-react'
import { staticTimelineSource } from './staticTimelineSource'
import type {
    SourceError,
    SourcePage,
    TimelineEntry,
    TimelineSource,
} from './types'
import { useTimelineSources } from './useTimelineSources'

type Answer = Result<SourcePage<null>, SourceError>

interface Call {
    cursor: unknown
    signal: AbortSignal
    answer(answer: Answer): void
}

/** A source whose requests stay open until the test answers them. */
const controlledSource = (key: string, revision?: number) => {
    const calls: Call[] = []
    const source: TimelineSource<null> = {
        key,
        label: key.toUpperCase(),
        revision,
        fetchPage: (cursor, signal) =>
            new Promise<Answer>((resolve) =>
                calls.push({ cursor, signal, answer: resolve })
            ),
    }
    return { source, calls }
}

const entry = (
    id: string,
    at: string,
    sourceKey: string
): TimelineEntry<null> => ({
    id,
    at,
    sourceKey,
    data: null,
})

const lastCall = (calls: Call[]) => {
    const call = calls.at(-1)
    if (call === undefined) {
        throw new Error('no request was made')
    }
    return call
}

const render = (sources: TimelineSource<null>[]) =>
    renderHook(
        (props?: { sources: TimelineSource<null>[] }) =>
            useTimelineSources(props?.sources ?? []),
        { initialProps: { sources } }
    )

describe('useTimelineSources', () => {
    it('reports per-source status and an overall loading → ready', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b')
        const { result, act } = await render([a.source, b.source])

        expect(result.current.status).toBe('loading')
        expect(
            result.current.sources.map((s) => [s.key, s.label, s.status])
        ).toEqual([
            ['a', 'A', 'loading'],
            ['b', 'B', 'loading'],
        ])

        await act(() =>
            lastCall(a.calls).answer(
                Result.ok({
                    entries: [entry('a1', '2026-10-10T09:00', 'a')],
                    nextCursor: 2,
                    completeUntil: '2026-10-01',
                })
            )
        )
        await expect
            .poll(() => result.current.sources[0]?.status)
            .toBe('hasMore')
        expect(result.current.status).toBe('loading')
        expect(result.current.entries).toEqual([])
        // b is still on its first page, so there is nothing loadMore could fetch.
        expect(result.current.hasMore).toBe(false)

        await act(() =>
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b1', '2026-10-05T09:00', 'b')] })
            )
        )
        await expect.poll(() => result.current.status).toBe('ready')
        expect(result.current.sources.map((s) => s.status)).toEqual([
            'hasMore',
            'complete',
        ])
        expect(result.current.entries.map((e) => e.id)).toEqual(['a1', 'b1'])
        expect(result.current.hasMore).toBe(true)

        await act(() => result.current.loadMore())
        expect(a.calls).toHaveLength(2)
        expect(lastCall(a.calls).cursor).toBe(2)
        expect(b.calls).toHaveLength(1)
        await expect.poll(() => result.current.loadingMore).toBe(true)
    })

    it('retries one source without refetching the others', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b')
        const { result, act } = await render([a.source, b.source])

        await act(() => {
            lastCall(a.calls).answer(
                Result.err({ kind: 'failed', error: new Error('boom') })
            )
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b1', '2026-09-01', 'b')] })
            )
        })
        await expect.poll(() => result.current.sources[0]?.status).toBe('error')
        expect(result.current.sources[0]?.error).toEqual({
            kind: 'failed',
            error: new Error('boom'),
        })
        expect(result.current.status).toBe('ready')

        await act(() => result.current.retry('a'))
        expect(a.calls).toHaveLength(2)
        expect(lastCall(a.calls).cursor).toBeUndefined()
        expect(b.calls).toHaveLength(1)
        // The retrying source doesn't hold the others back.
        await expect
            .poll(() => result.current.sources[0]?.status)
            .toBe('loading')
        expect(result.current.status).toBe('ready')
        expect(result.current.entries.map((e) => e.id)).toEqual(['b1'])

        await act(() =>
            lastCall(a.calls).answer(
                Result.ok({ entries: [entry('a1', '2026-10-10', 'a')] })
            )
        )
        await expect
            .poll(() => result.current.sources[0]?.status)
            .toBe('complete')
        expect(result.current.sources[0]?.error).toBeUndefined()
        expect(result.current.entries.map((e) => e.id)).toEqual(['a1', 'b1'])
    })

    it('restarts only the source whose revision changed', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b', 1)
        const { result, act, rerender } = await render([a.source, b.source])

        await act(() => {
            lastCall(a.calls).answer(
                Result.ok({ entries: [entry('a1', '2026-10-10', 'a')] })
            )
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b1', '2026-10-09', 'b')] })
            )
        })
        await expect.poll(() => result.current.entries.length).toBe(2)

        // A fresh array with an unchanged `a` and a new revision of `b`.
        await rerender({
            sources: [{ ...a.source }, { ...b.source, revision: 2 }],
        })
        expect(a.calls).toHaveLength(1)
        expect(b.calls).toHaveLength(2)
        expect(lastCall(b.calls).cursor).toBeUndefined()
        await expect
            .poll(() => result.current.sources[1]?.status)
            .toBe('loading')
        expect(result.current.sources[0]?.status).toBe('complete')
        // b's old entries stay on show and the feed stays ready meanwhile.
        expect(result.current.status).toBe('ready')
        expect(result.current.entries.map((e) => e.id)).toEqual(['a1', 'b1'])

        await act(() =>
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b2', '2026-10-08', 'b')] })
            )
        )
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['a1', 'b2'])
        expect(result.current.status).toBe('ready')
    })

    it('starts a source afresh, dropping its entries, when its subject changes', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b')
        const { result, act, rerender } = await render([
            a.source,
            { ...b.source, subject: 'te1', revision: 1 },
        ])

        await act(() => {
            lastCall(a.calls).answer(
                Result.ok({ entries: [entry('a1', '2026-10-10', 'a')] })
            )
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b1', '2026-10-09', 'b')] })
            )
        })
        await expect.poll(() => result.current.entries.length).toBe(2)

        // Same revision, new subject: the old record's entries go at once.
        await rerender({
            sources: [a.source, { ...b.source, subject: 'te2', revision: 1 }],
        })
        expect(a.calls).toHaveLength(1)
        expect(b.calls).toHaveLength(2)
        expect(lastCall(b.calls).cursor).toBeUndefined()
        await expect.poll(() => result.current.status).toBe('loading')
        expect(result.current.entries).toEqual([])

        await act(() =>
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b2', '2026-10-08', 'b')] })
            )
        )
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['a1', 'b2'])
    })

    it('shows new static entries when the static source gets a new revision', async () => {
        const notes = (entries: TimelineEntry<null>[], revision: number) =>
            staticTimelineSource('notes', 'Notes', entries, { revision })
        const { result, rerender } = await render([
            notes([entry('n1', '2026-10-01', 'notes')], 1),
        ])
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['n1'])

        await rerender({
            sources: [
                notes(
                    [
                        entry('n2', '2026-10-02', 'notes'),
                        entry('n1', '2026-10-01', 'notes'),
                    ],
                    2
                ),
            ],
        })
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['n2', 'n1'])
    })

    it('resumes a source that failed mid-paging from its stored cursor', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b')
        const { result, act } = await render([a.source, b.source])

        await act(() => {
            lastCall(a.calls).answer(
                Result.ok({
                    entries: [entry('a1', '2026-10-05T09:00', 'a')],
                    nextCursor: 2,
                    completeUntil: '2026-10-01',
                })
            )
            lastCall(b.calls).answer(
                Result.ok({ entries: [entry('b1', '2026-09-01', 'b')] })
            )
        })
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['a1'])

        await act(() => result.current.loadMore())
        await act(() =>
            lastCall(a.calls).answer(
                Result.err({ kind: 'failed', error: new Error('page 2') })
            )
        )
        // The failed source stops limiting, so b's older entry shows.
        await expect.poll(() => result.current.sources[0]?.status).toBe('error')
        expect(result.current.entries.map((e) => e.id)).toEqual(['a1', 'b1'])
        expect(result.current.hasMore).toBe(false)

        await act(() => result.current.retry('a'))
        expect(a.calls).toHaveLength(3)
        expect(lastCall(a.calls).cursor).toBe(2)
        expect(b.calls).toHaveLength(1)
        expect(result.current.status).toBe('ready')

        await act(() =>
            lastCall(a.calls).answer(
                Result.ok({ entries: [entry('a2', '2026-09-15T09:00', 'a')] })
            )
        )
        await expect
            .poll(() => result.current.entries.map((e) => e.id))
            .toEqual(['a1', 'a2', 'b1'])
        expect(result.current.sources[0]?.status).toBe('complete')
    })

    it('aborts in-flight requests on unmount', async () => {
        const a = controlledSource('a')
        const b = controlledSource('b')
        const { unmount } = await render([a.source, b.source])
        const signals = [lastCall(a.calls).signal, lastCall(b.calls).signal]
        expect(signals.map((s) => s.aborted)).toEqual([false, false])

        await unmount()
        expect(signals.map((s) => s.aborted)).toEqual([true, true])
    })

    describe('with fake timers', () => {
        beforeEach(() => {
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        })
        afterEach(() => {
            vi.useRealTimers()
        })

        it('times out a first page after 30 s', async () => {
            const a = controlledSource('a')
            const { result, act } = await render([a.source])
            const { signal } = lastCall(a.calls)

            await act(() => vi.advanceTimersByTime(29_999))
            expect(result.current.sources[0]?.status).toBe('loading')
            expect(signal.aborted).toBe(false)

            await act(() => vi.advanceTimersByTime(1))
            expect(signal.aborted).toBe(true)
            expect(result.current.sources[0]?.status).toBe('error')
            expect(result.current.sources[0]?.error).toEqual({
                kind: 'failed',
                error: new Error('Timed out'),
            })
            expect(result.current.status).toBe('ready')
        })
    })
})
