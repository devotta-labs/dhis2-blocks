import {
    applyError,
    applyPage,
    initialMergeState,
    limitingSources,
    retainSources,
    startLoading,
    visibleEntries,
    type MergeState,
} from './merge'
import { comparableKey, compareEntries } from './sort'
import type { SourcePage, TimelineEntry } from './types'

const entry = (
    id: string,
    at: string,
    extra: Partial<TimelineEntry> = {}
): TimelineEntry => ({ id, at, sourceKey: 'a', data: null, ...extra })

const ids = (entries: TimelineEntry[]) => entries.map((e) => e.id)

const page = (
    entries: TimelineEntry[],
    completeUntil?: string
): SourcePage<unknown> =>
    completeUntil === undefined
        ? { entries }
        : { entries, nextCursor: 'next', completeUntil }

/** Each source answers one page: a date means "has more, complete until that day". */
const stateWithCutoffs = (cutoffs: Readonly<Record<string, string>>) => {
    let state = initialMergeState(Object.keys(cutoffs))
    for (const [key, cutoff] of Object.entries(cutoffs)) {
        state = applyPage(
            state,
            key,
            page([], cutoff === 'complete' ? undefined : cutoff)
        )
    }
    return state
}

describe('merge', () => {
    it('shows nothing in the past phase until every source has answered its first page', () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(
            state,
            'a',
            page([entry('a1', '2026-10-10T09:00'), entry('a2', '2026-01-01')])
        )
        expect(visibleEntries(state)).toEqual([])

        state = applyPage(state, 'b', page([]))
        expect(ids(visibleEntries(state))).toEqual(['a1', 'a2'])
    })

    it("holds back entries older than the slowest source's completeUntil", () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(
            state,
            'a',
            page([
                entry('a-new', '2026-10-10T09:00'),
                entry('a-old', '2026-09-15T09:00'),
            ])
        )
        state = applyPage(
            state,
            'b',
            page(
                [entry('b-new', '2026-10-05T09:00', { sourceKey: 'b' })],
                '2026-10-01'
            )
        )
        expect(ids(visibleEntries(state))).toEqual(['a-new', 'b-new'])
    })

    it("releases held entries when the limiting source's next page arrives", () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(
            state,
            'a',
            page([entry('a-old', '2026-09-15T09:00')])
        )
        state = applyPage(state, 'b', page([], '2026-10-01'))
        expect(visibleEntries(state)).toEqual([])

        state = startLoading(state, 'b', 'more')
        state = applyPage(
            state,
            'b',
            page([entry('b-old', '2026-09-20T09:00', { sourceKey: 'b' })])
        )
        expect(ids(visibleEntries(state))).toEqual(['b-old', 'a-old'])
    })

    it('asks only the limiting sources for their next page', () =>
        expect(
            limitingSources(
                stateWithCutoffs({
                    a: '2026-10-01',
                    b: '2026-09-01',
                    c: 'complete',
                })
            )
        ).toEqual(['a']))

    it('does not let a failed or unsupported source limit the feed', () => {
        let state = initialMergeState(['a', 'b', 'c'])
        state = applyPage(state, 'a', page([entry('a1', '2020-01-01')]))
        state = applyError(state, 'b', {
            kind: 'failed',
            error: new Error('boom'),
        })
        state = applyError(state, 'c', {
            kind: 'unsupported',
            message: 'Needs 42',
        })
        expect(ids(visibleEntries(state))).toEqual(['a1'])
        expect(limitingSources(state)).toEqual([])
    })

    it('always shows future and overdue entries', () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(
            state,
            'a',
            page(
                [
                    entry('due', '2027-01-01', { phase: 'future' }),
                    entry('late', '2026-01-01', { phase: 'overdue' }),
                    entry('past', '2026-01-01T09:00', { phase: 'past' }),
                ],
                '2025-01-01'
            )
        )
        // b has not answered, so the past phase is held back entirely.
        expect(ids(visibleEntries(state))).toEqual(['due', 'late'])
    })

    it('shows undated entries only once no source limits the feed', () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(
            state,
            'a',
            page([entry('a1', '2026-10-01T09:00'), entry('odd', 'unknown')])
        )
        state = applyPage(state, 'b', page([], '2026-01-01'))
        expect(ids(visibleEntries(state))).toEqual(['a1'])

        state = startLoading(state, 'b', 'more')
        state = applyPage(state, 'b', page([]))
        expect(ids(visibleEntries(state))).toEqual(['a1', 'odd'])
    })

    it('collapses duplicate ids to the latest copy', () => {
        let state = initialMergeState(['a'])
        state = applyPage(
            state,
            'a',
            page(
                [entry('x', '2026-10-01T09:00', { data: 'old' })],
                '2026-01-01'
            )
        )
        state = startLoading(state, 'a', 'more')
        state = applyPage(
            state,
            'a',
            page([entry('x', '2026-10-01T09:00', { data: 'new' })])
        )
        const visible = visibleEntries(state)
        expect(visible).toHaveLength(1)
        expect(visible[0]?.data).toBe('new')
    })

    it('drops a removed source with its entries and adds a new one as loading', () => {
        let state = initialMergeState(['a', 'b'])
        state = applyPage(state, 'a', page([entry('a1', '2026-10-01')]))
        state = applyPage(
            state,
            'b',
            page([entry('b1', '2026-10-02', { sourceKey: 'b' })])
        )
        state = retainSources(state, ['b'])
        expect(ids(visibleEntries(state))).toEqual(['b1'])

        state = retainSources(state, ['b', 'c'])
        expect(state.sources.get('c')?.status).toBe('loading')
        expect(visibleEntries(state)).toEqual([])
    })

    it('interleaves sources with page sizes 1, 7 and 50', () => {
        const sizes = new Map([
            ['one', 1],
            ['seven', 7],
            ['fifty', 50],
        ])
        const all = [...sizes.keys()].flatMap((key, offset) =>
            Array.from({ length: 60 }, (_, i) =>
                entry(
                    `${key}-${i}`,
                    `2026-${String(12 - (i % 12)).padStart(2, '0')}-${String(28 - Math.floor(i / 12) * 3 - offset).padStart(2, '0')}T09:00`,
                    { sourceKey: key }
                )
            )
        )
        const sorted = (key: string) =>
            all.filter((e) => e.sourceKey === key).sort(compareEntries('desc'))
        const served = new Map<string, number>()
        let state: MergeState<unknown> = initialMergeState([...sizes.keys()])
        const serve = (key: string) => {
            const from = served.get(key) ?? 0
            const rows = sorted(key).slice(from, from + (sizes.get(key) ?? 0))
            served.set(key, from + rows.length)
            const done = from + rows.length >= 60
            state = applyPage(
                state,
                key,
                page(rows, done ? undefined : rows.at(-1)?.at)
            )
        }
        serve('one')
        serve('seven')
        serve('fifty')
        let shown = ids(visibleEntries(state))
        for (let round = 0; limitingSources(state).length > 0; round++) {
            expect(round).toBeLessThan(500)
            for (const key of limitingSources(state)) {
                state = startLoading(state, key, 'more')
                serve(key)
            }
            const now = ids(visibleEntries(state))
            expect(now.slice(0, shown.length)).toEqual(shown)
            shown = now
        }
        expect(ids(visibleEntries(state))).toEqual(
            ids([...all].sort(compareEntries('desc')))
        )
    })

    it('never inserts above the last visible entry on loadMore (property, 500 seeded runs)', () => {
        for (let seed = 1; seed <= 500; seed++) {
            const random = mulberry32(seed)
            const sources = randomSources(random)
            let state = initialMergeState(sources.map((s) => s.key))
            for (const source of sources) {
                state = applyPage(state, source.key, source.next())
            }
            let shown = ids(visibleEntries(state))
            for (let step = 0; limitingSources(state).length > 0; step++) {
                if (step > 1000) {
                    throw new Error(`seed ${seed}: did not finish`)
                }
                for (const key of limitingSources(state)) {
                    const source = sources.find((s) => s.key === key)
                    if (source === undefined) {
                        throw new Error(`unknown source ${key}`)
                    }
                    state = startLoading(state, key, 'more')
                    state = applyPage(state, key, source.next())
                }
                const now = ids(visibleEntries(state))
                expect(now.slice(0, shown.length), `seed ${seed}`).toEqual(
                    shown
                )
                shown = now
            }
            // Once every source is complete, everything is shown.
            expect(shown.length, `seed ${seed}`).toBe(
                sources.reduce((n, s) => n + s.total, 0)
            )
        }
    })
})

function mulberry32(seed: number) {
    let a = seed
    return () => {
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const sourceCompare = compareEntries('desc')

/** An honest pager: it only claims completeness where its next entry is strictly older. */
function randomSources(random: () => number) {
    const pick = (n: number) => Math.floor(random() * n)
    // A small pool of days and times so timestamps collide across and within sources.
    const days = ['2026-10-03', '2026-10-02', '2026-10-01', '2026-09-30']
    const times = ['T00:00:00.000', 'T08:30:00.000', 'T23:59:00.000']
    return Array.from({ length: 1 + pick(4) }, (_, s) => {
        const key = `s${s}`
        const entries = Array.from({ length: pick(41) }, (_, i) => {
            const day = days[pick(days.length)] ?? ''
            const roll = random()
            return roll < 0.05
                ? entry(`${key}-${i}`, 'undated', { sourceKey: key })
                : roll < 0.3
                  ? entry(`${key}-${i}`, day, {
                        sourceKey: key,
                        precision: 'day',
                    })
                  : entry(`${key}-${i}`, day + times[pick(times.length)], {
                        sourceKey: key,
                        sequence: pick(2),
                    })
        }).sort(sourceCompare)
        const size = 1 + pick(10)
        let from = 0
        const next = (): SourcePage<unknown> => {
            const rows = entries.slice(from, from + size)
            from += rows.length
            const following = entries[from]
            if (following === undefined) {
                return { entries: rows }
            }
            // The oldest returned entry that is strictly newer than the next one.
            const nextKey = comparableKey(following)
            const bound = entries.slice(0, from).findLast((e) => {
                const key = comparableKey(e)
                return (
                    key !== undefined &&
                    (nextKey === undefined || key > nextKey)
                )
            })
            return { entries: rows, nextCursor: from, completeUntil: bound?.at }
        }
        return { key, next, total: entries.length }
    })
}
