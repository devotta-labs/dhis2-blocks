import { describe, expect, it } from 'vitest'
import { tallyCounts } from '../core/counts'
import { mergeTallyEntries } from '../core/entries'
import { indexLayout } from '../core/layout'
import type { TallyEntry } from '../core/types'
import {
    BOY,
    correctionOn,
    GIRL,
    OLDER_GIRL,
    tapOn,
    VACCINATIONS,
} from '../test/tally.fixture'
import { createTallyStore, MAX_COUNT } from './store'

const index = indexLayout(VACCINATIONS)
const cell = (row: string, options = GIRL) => index.cellOf(row, options) ?? -1

const session = (entries: readonly TallyEntry[] = [], by?: string) => {
    const log: TallyEntry[] = [...entries]
    let made = 0
    const store = createTallyStore({
        layout: VACCINATIONS,
        entries,
        by,
        onAppend: (added) => log.push(...added),
        newId: () => {
            made += 1
            return `${by ?? 'device'}-${made}`
        },
        now: () => new Date(Date.UTC(2026, 10, 25, 9, 0, made)).toISOString(),
    })
    return { store, log, state: () => store.getState() }
}

describe('tapping', () => {
    it('adds one to the cell and hands the host the one entry', () => {
        const { state, log } = session()
        expect(state().tap(cell('opv1'))).toBe(1)
        expect(state().tap(cell('opv1'))).toBe(2)
        expect(state().counts[cell('opv1')]).toBe(2)
        expect(state().rowTotals[2]).toBe(2)
        expect(state().total).toBe(2)
        expect(log).toHaveLength(2)
        expect(log[0]).toMatchObject({
            kind: 'tap',
            row: 'opv1',
            options: GIRL,
        })
    })

    it('counts taps made before the host has given the log back', () => {
        const { store, state } = session()
        const stale: TallyEntry[] = []
        state().tap(cell('opv1'))
        state().tap(cell('opv1'))
        store.getState().receive(stale)
        state().tap(cell('opv1'))
        expect(state().counts[cell('opv1')]).toBe(3)
    })

    it('takes no tap on a closed cell or a cell the sheet does not have', () => {
        const { state, log } = session()
        expect(state().tap(cell('bcg', OLDER_GIRL))).toBeUndefined()
        expect(state().tap(999)).toBeUndefined()
        expect(log).toEqual([])
    })

    it('shows a tap on a cell that joined logs left below zero', () => {
        const { state } = session([
            tapOn('opv1', GIRL),
            correctionOn('opv1', GIRL, -1),
            correctionOn('opv1', GIRL, -1),
        ])
        expect(state().counts[cell('opv1')]).toBe(0)
        expect(state().tap(cell('opv1'))).toBe(1)
        expect(state().counts[cell('opv1')]).toBe(1)
        state().undo()
        expect(state().counts[cell('opv1')]).toBe(0)
    })
})

describe('undoing', () => {
    it('takes back the latest tap, then the one before, then nothing', () => {
        const { state, log } = session()
        state().tap(cell('opv1'))
        state().tap(cell('penta1', BOY))
        expect(state().canUndo).toBe(true)
        expect(state().undo()).toEqual([cell('penta1', BOY)])
        expect(state().counts[cell('penta1', BOY)]).toBe(0)
        expect(state().undo()).toEqual([cell('opv1')])
        expect(state().total).toBe(0)
        expect(state().canUndo).toBe(false)
        expect(state().undo()).toEqual([])
        expect(log).toHaveLength(4)
    })

    it('takes back a set of corrections together, before the taps made earlier', () => {
        const { state } = session()
        state().tap(cell('opv1'))
        const sums = state().sums()
        state().correct([
            {
                cell: cell('opv1'),
                sumBefore: sums[cell('opv1')] ?? 0,
                count: 0,
            },
            { cell: cell('bcg'), sumBefore: sums[cell('bcg')] ?? 0, count: 5 },
        ])
        expect(state().total).toBe(5)
        expect(state().undo().toSorted()).toEqual(
            [cell('bcg'), cell('opv1')].toSorted()
        )
        expect(state().counts[cell('opv1')]).toBe(1)
        expect(state().counts[cell('bcg')]).toBe(0)
        state().undo()
        expect(state().total).toBe(0)
    })

    it('never leaves a cell below zero on one device', () => {
        const { state } = session()
        state().tap(cell('opv1'))
        state().correct([{ cell: cell('opv1'), sumBefore: 1, count: 0 }])
        state().undo()
        state().undo()
        expect(state().sums()[cell('opv1')]).toBe(0)
        state().tap(cell('opv1'))
        expect(state().counts[cell('opv1')]).toBe(1)
    })

    it('reaches only the entries made since the sheet opened when the device has no name', () => {
        const earlier = tapOn('bcg', BOY)
        const { state } = session([earlier])
        expect(state().canUndo).toBe(false)
        state().tap(cell('opv1'))
        expect(state().undo()).toEqual([cell('opv1')])
        expect(state().counts[cell('bcg', BOY)]).toBe(1)
        expect(state().canUndo).toBe(false)
    })

    it('reaches a named device’s entries from before a reload', () => {
        const mine = tapOn('bcg', BOY, 'tablet')
        const { state } = session([mine], 'tablet')
        expect(state().canUndo).toBe(true)
        state().undo()
        expect(state().total).toBe(0)
    })

    it('takes taps back in the order they were made when the clock is set back', () => {
        const log: TallyEntry[] = []
        const clock = ['2026-11-25T12:00:00.000Z', '2026-11-25T11:00:00.000Z']
        let read = 0
        const store = createTallyStore({
            layout: VACCINATIONS,
            entries: [],
            by: 'tablet',
            onAppend: (added) => log.push(...added),
            now: () => {
                read += 1
                return clock[Math.min(read - 1, 1)] ?? ''
            },
        })
        store.getState().tap(cell('opv1'))
        store.getState().tap(cell('penta1'))
        expect(log.map(({ at }) => at)).toEqual([
            '2026-11-25T12:00:00.000Z',
            '2026-11-25T12:00:00.001Z',
        ])
        const again = createTallyStore({
            layout: VACCINATIONS,
            entries: mergeTallyEntries(log, [tapOn('bcg', GIRL, 'phone')]),
            by: 'tablet',
        })
        expect(again.getState().undo()).toEqual([cell('penta1')])
    })

    it('leaves another device’s entries alone', () => {
        const theirs = tapOn('bcg', BOY, 'phone')
        const { state } = session([theirs], 'tablet')
        expect(state().canUndo).toBe(false)
        state().tap(cell('opv1'))
        state().undo()
        expect(state().counts[cell('bcg', BOY)]).toBe(1)
        expect(state().canUndo).toBe(false)
    })
})

describe('correcting', () => {
    it('brings a cell to the typed count and reports how many changed', () => {
        const { state, log } = session([tapOn('opv1', GIRL)])
        const changed = state().correct([
            { cell: cell('opv1'), sumBefore: 1, count: 7 },
            { cell: cell('bcg'), sumBefore: 0, count: 0 },
        ])
        expect(changed).toBe(1)
        expect(state().counts[cell('opv1')]).toBe(7)
        expect(log.at(-1)).toMatchObject({ kind: 'correction', delta: 6 })
    })

    it('keeps taps that arrived while the count was being typed', () => {
        const first = [tapOn('opv1', GIRL)]
        const { store, state } = session(first)
        const sumBefore = state().sums()[cell('opv1')] ?? 0
        store
            .getState()
            .receive([
                ...first,
                tapOn('opv1', GIRL, 'phone'),
                tapOn('opv1', GIRL, 'phone'),
            ])
        state().correct([{ cell: cell('opv1'), sumBefore, count: 5 }])
        expect(state().counts[cell('opv1')]).toBe(7)
    })

    it('lands on the typed count from a sum below zero', () => {
        const { state } = session([correctionOn('opv1', GIRL, -1)])
        const sumBefore = state().sums()[cell('opv1')] ?? 0
        expect(sumBefore).toBe(-1)
        state().correct([{ cell: cell('opv1'), sumBefore, count: 5 }])
        expect(state().counts[cell('opv1')]).toBe(5)
    })

    it('holds a typed count to six digits and ignores what is not a number', () => {
        const { state } = session()
        state().correct([
            { cell: cell('opv1'), sumBefore: 0, count: 1e20 },
            { cell: cell('bcg'), sumBefore: 0, count: Number.NaN },
            { cell: cell('penta1'), sumBefore: 0, count: -4 },
        ])
        expect(state().counts[cell('opv1')]).toBe(MAX_COUNT)
        expect(state().counts[cell('bcg')]).toBe(0)
        expect(state().counts[cell('penta1')]).toBe(0)
        state().tap(cell('opv1'))
        expect(state().counts[cell('opv1')]).toBe(MAX_COUNT + 1)
    })

    it('lets a closed cell that holds a count be put right', () => {
        const { state } = session([tapOn('bcg', OLDER_GIRL)])
        state().correct([
            { cell: cell('bcg', OLDER_GIRL), sumBefore: 1, count: 0 },
        ])
        expect(state().total).toBe(0)
    })
})

describe('receiving the host’s log', () => {
    it('adds only what is new when the log continues the last one', () => {
        const first = [tapOn('opv1', GIRL)]
        const { store, state } = session(first)
        store.getState().receive([...first, tapOn('opv1', BOY)])
        expect(state().total).toBe(2)
    })

    it('does not count its own entries twice when the host gives them back', () => {
        const { store, state, log } = session()
        state().tap(cell('opv1'))
        state().tap(cell('opv1'))
        store.getState().receive([...log])
        expect(state().counts[cell('opv1')]).toBe(2)
    })

    it('keeps its own taps when the host joins in another device’s log before handing them back', () => {
        const first = [tapOn('opv1', GIRL)]
        const { store, state, log } = session(first, 'tablet')
        state().tap(cell('opv1'))
        state().tap(cell('opv1'))
        const earlier = {
            ...tapOn('bcg', BOY, 'phone'),
            at: '2026-01-01T00:00:00.000Z',
        }
        store.getState().receive(mergeTallyEntries(first, [earlier]))
        expect(state().counts[cell('opv1')]).toBe(3)
        expect(state().counts[cell('bcg', BOY)]).toBe(1)
        expect(state().canUndo).toBe(true)
        expect(state().replaced).toBe(0)
        store.getState().receive(mergeTallyEntries(log, [earlier]))
        expect(state().counts[cell('opv1')]).toBe(3)
        expect(state().total).toBe(4)
    })

    it('counts every entry of a joined log that puts new ones in the middle', () => {
        const a = tapOn('opv1', GIRL)
        const t = tapOn('penta1', GIRL)
        const { store, state } = session([a, t])
        const r = {
            ...tapOn('bcg', GIRL, 'phone'),
            at: '2026-01-01T00:00:00.000Z',
        }
        store.getState().receive([r, a, t])
        expect(state().total).toBe(3)
    })

    it('starts again from a log that is missing an entry it was given', () => {
        const { store, state } = session([tapOn('opv1', GIRL)])
        state().tap(cell('bcg'))
        store.getState().receive([tapOn('penta1', BOY)])
        expect(state().replaced).toBe(1)
        expect(state().total).toBe(1)
        expect(state().counts[cell('penta1', BOY)]).toBe(1)
        store.getState().receive([])
        expect(state().total).toBe(0)
    })

    it('settles a cell below zero once when two devices each tap it', () => {
        const shared = [
            tapOn('opv1', GIRL),
            correctionOn('opv1', GIRL, -1),
            correctionOn('opv1', GIRL, -1),
        ]
        const tablet = session(shared, 'tablet')
        const phone = session(shared, 'phone')
        expect(tablet.state().tap(cell('opv1'))).toBe(1)
        expect(phone.state().tap(cell('opv1'))).toBe(1)
        const joined = mergeTallyEntries(tablet.log, phone.log)
        expect(
            tallyCounts(VACCINATIONS, joined).filter(
                ({ row, count }) => row === 'opv1' && count > 0
            )
        ).toEqual([{ row: 'opv1', options: GIRL, count: 2 }])
        tablet.state().undo()
        expect(tablet.state().counts[cell('opv1')]).toBe(0)
        expect(tablet.state().canUndo).toBe(false)
    })

    it('adds up two devices the same on both', () => {
        const tablet = session([], 'tablet')
        const phone = session([], 'phone')
        tablet.state().tap(cell('opv1'))
        tablet.state().tap(cell('opv1'))
        tablet.state().undo()
        phone.state().tap(cell('opv1'))
        phone.state().tap(cell('bcg'))
        const joined = mergeTallyEntries(tablet.log, phone.log)
        tablet.store.getState().receive(joined)
        phone.store.getState().receive(mergeTallyEntries(phone.log, tablet.log))
        expect(tablet.state().counts).toEqual(phone.state().counts)
        expect(tablet.state().counts[cell('opv1')]).toBe(2)
        expect(
            tallyCounts(VACCINATIONS, joined).filter(({ count }) => count > 0)
        ).toEqual([
            { row: 'bcg', options: GIRL, count: 1 },
            { row: 'opv1', options: GIRL, count: 2 },
        ])
    })
})
