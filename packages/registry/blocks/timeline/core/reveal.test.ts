import { revealPast } from './reveal'
import { groupTimeline } from './group'
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
    it.each([
        ['2026-10-21T23:30-10:00', undefined, 'past', true],
        ['2026-10-23T00:30+14:00', undefined, 'future', false],
        ['2026-10-21', 'past', 'past', true],
        ['2026-10-23', 'past', 'past', true],
        ['2026-10-21', 'future', 'future', false],
        ['2026-10-23', 'future', 'future', false],
        ['2026-10-21', 'overdue', 'overdue', false],
        ['2026-10-23', 'overdue', 'overdue', false],
        ['', undefined, 'undated', true],
        ['', 'past', 'undated', true],
        ['', 'future', 'undated', true],
        ['', 'overdue', 'undated', true],
        ['unreadable', undefined, 'undated', true],
        ['unreadable', 'past', 'undated', true],
        ['unreadable', 'future', 'undated', true],
        ['unreadable', 'overdue', 'undated', true],
    ] as const)(
        'groups and reveals %s / %s consistently',
        (at, phase, expectedPhase, limited) => {
            const candidate = entry('candidate', at, { phase })
            const { groups } = groupTimeline([candidate], {
                today: TODAY,
                order: 'desc',
                groupBy: 'day',
                calendar: 'iso8601',
                labels: {
                    overdue: 'Overdue',
                    undated: 'Undated',
                    allEntries: 'All',
                },
            })
            expect(groups[0].phase).toBe(expectedPhase)
            const revealed = revealPast([candidate], { count: 0, today: TODAY })
            expect(ids(revealed.entries)).toEqual(limited ? [] : ['candidate'])
            expect(revealed.hidden).toBe(limited ? 1 : 0)
        }
    )

    it('reveals undated entries last even when they explicitly claim future or overdue', () => {
        const candidates = [
            entry('undated-future', '', { phase: 'future' }),
            entry('dated', '2026-10-20'),
            entry('undated-overdue', 'unknown', { phase: 'overdue' }),
        ]
        expect(
            ids(revealPast(candidates, { count: 1, today: TODAY }).entries)
        ).toEqual(['dated'])
        expect(
            ids(revealPast(candidates, { count: 2, today: TODAY }).entries)
        ).toEqual(['undated-future', 'dated'])
        expect(revealPast(candidates, { count: 3, today: TODAY }).hidden).toBe(
            0
        )
    })

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
