import { compareEntries, cutoffKey, sortKey } from './sort'
import type { TimelineEntry } from './types'

const entry = (
    at: string,
    extra: Partial<TimelineEntry> = {}
): TimelineEntry => ({
    id: at,
    at,
    sourceKey: 'events',
    data: null,
    ...extra,
})

const ids = (entries: TimelineEntry[]) => entries.map((e) => e.id)

describe('compareEntries', () => {
    const entries = [
        entry('2026-10-14T09:00:00'),
        entry('2026-10-16T09:00:00'),
        entry('2026-10-15T09:00:00'),
    ]

    it('orders newest first by default and oldest first for asc', () => {
        expect(ids([...entries].sort(compareEntries('desc')))).toEqual([
            '2026-10-16T09:00:00',
            '2026-10-15T09:00:00',
            '2026-10-14T09:00:00',
        ])
        expect(ids([...entries].sort(compareEntries('asc')))).toEqual([
            '2026-10-14T09:00:00',
            '2026-10-15T09:00:00',
            '2026-10-16T09:00:00',
        ])
    })

    it('puts day-precision entries after instants on the same day when descending, before them when ascending', () => {
        const day = entry('2026-10-15', { id: 'day', precision: 'day' })
        const early = entry('2026-10-15T00:00:00', { id: 'early' })
        const late = entry('2026-10-15T23:59:59.999', { id: 'late' })
        expect(ids([early, day, late].sort(compareEntries('desc')))).toEqual([
            'late',
            'early',
            'day',
        ])
        expect(ids([late, day, early].sort(compareEntries('asc')))).toEqual([
            'day',
            'early',
            'late',
        ])
    })

    it('orders identical instants by sequence, then sourceKey, then id', () => {
        const at = '2026-10-15T09:00:00'
        const sorted = [
            entry(at, { id: 'b', sourceKey: 'b' }),
            entry(at, { id: 'z', sourceKey: 'a', sequence: 2 }),
            entry(at, { id: 'y', sourceKey: 'a', sequence: 1 }),
            entry(at, { id: 'd', sourceKey: 'a' }),
            entry(at, { id: 'c', sourceKey: 'a' }),
        ]
        const expected = ['c', 'd', 'b', 'y', 'z']
        // No sequence counts as 0; the tie-break does not flip with the order.
        expect(ids([...sorted].sort(compareEntries('asc')))).toEqual(expected)
        expect(ids([...sorted].sort(compareEntries('desc')))).toEqual(expected)
    })

    it('compares stored text, so 23:30 on the 14th sorts before 00:10 on the 15th', () => {
        const a = entry('2026-10-14T23:30:00', { id: 'a' })
        const b = entry('2026-10-15T00:10:00', { id: 'b' })
        expect(ids([b, a].sort(compareEntries('asc')))).toEqual(['a', 'b'])
    })

    it('sorts unreadable entries after every dated one in both orders', () => {
        const bad = entry('nonsense', { id: 'bad' })
        const good = entry('2026-10-15T09:00:00', { id: 'good' })
        expect(ids([bad, good].sort(compareEntries('asc')))).toEqual([
            'good',
            'bad',
        ])
        expect(ids([bad, good].sort(compareEntries('desc')))).toEqual([
            'good',
            'bad',
        ])
    })
})

describe('sortKey', () => {
    it('treats an offset as stored text and does not shift the day', () =>
        expect(sortKey(entry('2026-10-14T23:30:00+03:00'))?.slice(0, 10)).toBe(
            '2026-10-14'
        ))

    it('pads missing seconds and milliseconds', () => {
        expect(sortKey(entry('2026-10-14T09:05'))).toBe(
            '2026-10-14T09:05:00.000'
        )
        expect(sortKey(entry('2026-10-14T09:05:07.5Z'))).toBe(
            '2026-10-14T09:05:07.500'
        )
    })

    it('is undefined when the stored day is unreadable', () =>
        expect(sortKey(entry('soon'))).toBeUndefined())
})

describe('cutoffKey', () => {
    it('reads a date with no time as the whole day, like a day-precision entry', () => {
        const day = cutoffKey('2026-10-15') ?? ''
        expect(day < (sortKey(entry('2026-10-15T00:00')) ?? '')).toBe(true)
        expect(day > (sortKey(entry('2026-10-14T23:59:59.999')) ?? '')).toBe(
            true
        )
    })

    it('reads a date-time as that instant', () =>
        expect(cutoffKey('2026-10-15T09:05')).toBe('2026-10-15T09:05:00.000'))

    it('is undefined when unreadable', () =>
        expect(cutoffKey('later')).toBeUndefined())

    it('is undefined when the time is unreadable, rather than the whole day', () => {
        expect(cutoffKey('2026-10-01 09:00')).toBeUndefined()
        expect(cutoffKey('2026-10-01T09')).toBeUndefined()
    })
})
