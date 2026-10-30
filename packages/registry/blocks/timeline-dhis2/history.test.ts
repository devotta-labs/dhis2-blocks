import type { TimelineEntry } from '@/components/timeline/core/types'
import { addWhenReady, combineStatus, mergeHistory } from './history'
import type { HistoryResult } from './types'

const entry = (id: string): TimelineEntry<string> => ({
    id,
    at: '2026-10-22T10:00',
    data: id,
})

const result = (
    overrides: Partial<HistoryResult<string>> = {}
): HistoryResult<string> => ({
    entries: [],
    status: 'success',
    notices: [],
    isFetching: false,
    refetch: () => undefined,
    ...overrides,
})

describe('combineStatus', () => {
    it('is pending while any part is, error only when all failed, else success', () => {
        expect(combineStatus(['success', 'pending', 'error'])).toBe('pending')
        expect(combineStatus(['error', 'error'])).toBe('error')
        expect(combineStatus(['error', 'success'])).toBe('success')
        expect(combineStatus([])).toBe('success')
    })
})

describe('mergeHistory', () => {
    it('concatenates entries and notices, keeping the first notice of an id', () => {
        const merged = mergeHistory(
            result({
                entries: [entry('a')],
                notices: [{ id: 'x', tone: 'info', message: 'first' }],
            }),
            result({
                entries: [entry('b')],
                notices: [
                    { id: 'x', tone: 'info', message: 'again' },
                    { id: 'y', tone: 'warning', message: 'other' },
                ],
            })
        )

        expect(merged.entries.map((e) => e.id)).toEqual(['a', 'b'])
        expect(merged.notices.map((n) => n.message)).toEqual(['first', 'other'])
    })

    it('shows nothing until every part has answered once', () => {
        const merged = mergeHistory(
            result({ entries: [entry('a')] }),
            result({ status: 'pending' })
        )

        expect(merged.status).toBe('pending')
        expect(merged.entries).toEqual([])
    })

    it('refetches every part and reports fetching while any part is', () => {
        const first = vi.fn()
        const second = vi.fn()

        const merged = mergeHistory(
            result({ refetch: first, isFetching: true }),
            result({ refetch: second })
        )
        merged.refetch()

        expect(merged.isFetching).toBe(true)
        expect(first).toHaveBeenCalledTimes(1)
        expect(second).toHaveBeenCalledTimes(1)
    })
})

describe('addWhenReady', () => {
    it('shows the history while a part has not answered, adding the part when it has', () => {
        const history = result({ entries: [entry('a')] })

        const waiting = addWhenReady(
            history,
            result({ status: 'pending', isFetching: true })
        )
        expect(waiting.status).toBe('success')
        expect(waiting.entries.map((e) => e.id)).toEqual(['a'])
        expect(waiting.isFetching).toBe(true)

        const arrived = addWhenReady(history, result({ entries: [entry('b')] }))
        expect(arrived.entries.map((e) => e.id)).toEqual(['a', 'b'])
    })

    it('still waits for the history itself', () => {
        const merged = addWhenReady(
            result({ status: 'pending' }),
            result({ entries: [entry('b')] })
        )

        expect(merged.status).toBe('pending')
        expect(merged.entries).toEqual([])
    })

    it('is an error when the history failed and a part is still on its way', () => {
        const merged = addWhenReady(
            result({ status: 'error' }),
            result({ status: 'pending' })
        )

        expect(merged.status).toBe('error')
    })
})
