import { buildTimelineGroups, type GroupOptions } from './group'
import type { TimelineEntry } from './types'

const entry = (
    id: string,
    at: string,
    extra: Partial<TimelineEntry> = {}
): TimelineEntry => ({ id, at, sourceKey: 'events', data: null, ...extra })

const labels = { overdue: 'Overdue', undated: 'Undated', allEntries: 'All' }

const desc: GroupOptions<unknown> = {
    order: 'desc',
    groupBy: 'day',
    today: '2026-10-22',
    calendar: 'gregorian',
    locale: 'en',
    labels,
}
const asc: GroupOptions<unknown> = { ...desc, order: 'asc' }

const mixedEntries = [
    entry('past-a', '2026-10-20T10:00:00'),
    entry('past-b', '2026-10-21T10:00:00'),
    entry('future-a', '2026-10-24T10:00:00'),
    entry('future-b', '2026-10-25'),
    entry('overdue-a', '2026-10-10', { phase: 'overdue' }),
    entry('overdue-b', '2026-10-05', { phase: 'overdue' }),
    entry('bad', 'whenever'),
]

describe('buildTimelineGroups', () => {
    it('defaults phase from the stored day: after today is future, today and before is past', () => {
        const { groups } = buildTimelineGroups(
            [
                entry('later', '2026-10-23T00:00:00'),
                entry('now', '2026-10-22T23:59:00'),
                entry('earlier', '2026-10-21T00:00:00'),
            ],
            desc
        )
        expect(groups.map((g) => [g.key, g.phase])).toEqual([
            ['2026-10-23', 'future'],
            ['2026-10-22', 'past'],
            ['2026-10-21', 'past'],
        ])
    })

    it('lays out desc as future groups, now, overdue, past groups, undated', () => {
        const { groups, nowIndex } = buildTimelineGroups(mixedEntries, desc)
        expect(groups.map((g) => g.phase)).toEqual([
            'future',
            'future',
            'overdue',
            'past',
            'past',
            'undated',
        ])
        expect(nowIndex).toBe(2)
    })

    it('lays out asc as past groups, overdue, now, future groups, undated', () => {
        const { groups, nowIndex } = buildTimelineGroups(mixedEntries, asc)
        expect(groups.map((g) => g.phase)).toEqual([
            'past',
            'past',
            'overdue',
            'future',
            'future',
            'undated',
        ])
        expect(nowIndex).toBe(3)
    })

    it('puts the now marker at the end of the dated groups when one side is empty', () => {
        const onlyPast = [entry('p', '2026-10-01T10:00:00')]
        expect(buildTimelineGroups(onlyPast, desc).nowIndex).toBe(0)
        expect(buildTimelineGroups(onlyPast, asc).nowIndex).toBe(1)
        expect(buildTimelineGroups([], desc)).toEqual({
            groups: [],
            nowIndex: 0,
        })
    })

    it('puts all overdue entries in one group, oldest first, in both orders', () => {
        for (const options of [desc, asc]) {
            const overdue = buildTimelineGroups(
                mixedEntries,
                options
            ).groups.filter((g) => g.phase === 'overdue')
            expect(overdue).toHaveLength(1)
            expect(overdue[0].label).toBe('Overdue')
            expect(overdue[0].entries.map((e) => e.id)).toEqual([
                'overdue-b',
                'overdue-a',
            ])
        }
    })

    it('labels day groups in the system calendar', () => {
        const { groups } = buildTimelineGroups(
            [entry('e', '2026-10-14T09:00:00')],
            { ...desc, calendar: 'ethiopian' }
        )
        expect(groups[0].key).toBe('2026-10-14')
        expect(groups[0].label).toBe('2019-02-04')
    })

    it('groups late-evening entries on their stored day', () => {
        const { groups } = buildTimelineGroups(
            [
                entry('a', '2026-10-14T23:30:00+03:00'),
                entry('b', '2026-10-14T23:59:59'),
                entry('c', '2026-10-15T00:10:00'),
            ],
            asc
        )
        expect(groups.map((g) => [g.key, g.entries.map((e) => e.id)])).toEqual([
            ['2026-10-14', ['a', 'b']],
            ['2026-10-15', ['c']],
        ])
    })

    it('puts entries with an unreadable at in Undated at the end in input order, and warns once in development', async () => {
        vi.resetModules()
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { buildTimelineGroups: build } = await import('./group')
        const entries = [
            entry('x', 'nope'),
            entry('ok', '2026-10-20T10:00:00'),
            entry('y', ''),
        ]
        const first = build(entries, desc).groups
        build(entries, desc)
        expect(first.map((g) => g.phase)).toEqual(['past', 'undated'])
        expect(first[1]).toMatchObject({
            key: 'undated',
            label: 'Undated',
            phase: 'undated',
        })
        expect(first[1].entries.map((e) => e.id)).toEqual(['x', 'y'])
        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockRestore()
    })

    it('uses one group per key returned by a groupBy function, in sort order of first entry', () => {
        const { groups } = buildTimelineGroups(
            [
                entry('a1', '2026-10-20T10:00:00', { sourceKey: 'a' }),
                entry('b1', '2026-10-20T12:00:00', { sourceKey: 'b' }),
                entry('a2', '2026-10-20T14:00:00', { sourceKey: 'a' }),
            ],
            {
                ...desc,
                groupBy: (e) => ({
                    key: e.sourceKey,
                    label: `Source ${e.sourceKey}`,
                }),
            }
        )
        expect(
            groups.map((g) => [g.key, g.label, g.entries.map((e) => e.id)])
        ).toEqual([
            ['a', 'Source a', ['a2', 'a1']],
            ['b', 'Source b', ['b1']],
        ])
    })

    it('uses a single group labelled allEntries for groupBy none, still splitting phases', () => {
        const { groups, nowIndex } = buildTimelineGroups(mixedEntries, {
            ...desc,
            groupBy: 'none',
        })
        expect(groups.map((g) => [g.phase, g.label])).toEqual([
            ['future', 'All'],
            ['overdue', 'Overdue'],
            ['past', 'All'],
            ['undated', 'Undated'],
        ])
        expect(groups[0].entries.map((e) => e.id)).toEqual([
            'future-b',
            'future-a',
        ])
        expect(nowIndex).toBe(1)
    })
})
