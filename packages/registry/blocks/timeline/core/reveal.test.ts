import { revealPast } from './reveal'
import type { TimelineEntry } from './types'

const entry = (
    id: string,
    at: string,
    extra: Partial<TimelineEntry> = {}
): TimelineEntry => ({ id, at, data: null, ...extra })

const TODAY = '2026-10-22'

const ENTRIES = [
    entry('old', '2026-01-01T10:00'),
    entry('future', '2026-11-01'),
    entry('newest', '2026-10-21T10:00'),
    entry('overdue', '2026-09-01', { phase: 'overdue' }),
    entry('middle', '2026-05-01T10:00'),
    entry('undated', ''),
]

const ids = (entries: TimelineEntry[]) => entries.map((e) => e.id)

describe('revealPast', () => {
    it('keeps future and overdue entries and the newest past ones, in input order', () => {
        const { entries, hidden } = revealPast(ENTRIES, {
            count: 2,
            today: TODAY,
        })
        expect(ids(entries)).toEqual(['future', 'newest', 'overdue', 'middle'])
        expect(hidden).toBe(2)
    })

    it('returns everything when the past fits', () => {
        const { entries, hidden } = revealPast(ENTRIES, {
            count: 4,
            today: TODAY,
        })
        expect(ids(entries)).toEqual(ids(ENTRIES))
        expect(hidden).toBe(0)
    })

    it('treats today as past and an undated entry as the oldest', () => {
        const { entries } = revealPast(
            [entry('today', '2026-10-22T08:00'), entry('undated', '')],
            { count: 1, today: TODAY }
        )
        expect(ids(entries)).toEqual(['today'])
    })
})
