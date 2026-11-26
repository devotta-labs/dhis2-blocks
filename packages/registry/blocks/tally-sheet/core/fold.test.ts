import { describe, expect, it } from 'vitest'
import {
    BOY,
    correctionOn,
    GIRL,
    OLDER_GIRL,
    tapOn,
    undoOf,
    VACCINATIONS,
} from '../test/tally.fixture'
import { tallyCounts, unplacedTallyEntries } from './counts'
import { mergeTallyEntries } from './entries'
import { createFold } from './fold'
import { indexLayout } from './layout'
import type { TallyEntry } from './types'

const index = indexLayout(VACCINATIONS)
const cell = (row: string, options = GIRL) => index.cellOf(row, options) ?? -1

const counted = (entries: readonly TallyEntry[]) =>
    tallyCounts(VACCINATIONS, entries).filter(({ count }) => count > 0)

const foldOf = (entries: readonly TallyEntry[]) => {
    const fold = createFold(index)
    fold.take(entries)
    return fold
}

describe('folding a tally log', () => {
    it('counts each tap in its cell, its row and the total', () => {
        const fold = foldOf([
            tapOn('opv1', GIRL),
            tapOn('opv1', GIRL),
            tapOn('opv1', BOY),
            tapOn('bcg', GIRL),
        ])
        expect(fold.countOf(cell('opv1'))).toBe(2)
        expect(fold.countOf(cell('opv1', BOY))).toBe(1)
        expect(fold.rowTotals()).toEqual([1, 0, 3, 0, 0])
        expect(fold.total()).toBe(4)
    })

    it('counts an entry once however often it is given', () => {
        const taps = [tapOn('opv1', GIRL), tapOn('opv1', GIRL)]
        const fold = foldOf([...taps, ...taps])
        fold.take(taps)
        expect(fold.total()).toBe(2)
    })

    it('takes back the entry an undo names, once', () => {
        const first = tapOn('opv1', GIRL)
        const second = tapOn('penta1', BOY)
        const undo = undoOf(second)
        const fold = foldOf([first, second, undo, undoOf(second), undo])
        expect(fold.countOf(cell('penta1', BOY))).toBe(0)
        expect(fold.countOf(cell('opv1'))).toBe(1)
    })

    it('takes back an entry whose undo arrived first', () => {
        const tap = tapOn('opv1', GIRL)
        const fold = foldOf([undoOf(tap), tap])
        expect(fold.total()).toBe(0)
    })

    it('adds up the same in any order', () => {
        const taps = [
            tapOn('opv1', GIRL),
            tapOn('opv1', GIRL),
            tapOn('bcg', BOY),
        ]
        const entries = [
            ...taps,
            correctionOn('opv1', GIRL, 4),
            undoOf(taps[1] ?? taps[0]),
            correctionOn('bcg', BOY, -1),
        ]
        const forwards = foldOf(entries)
        const backwards = foldOf([...entries].reverse())
        expect(backwards.counts()).toEqual(forwards.counts())
        expect(backwards.rowTotals()).toEqual(forwards.rowTotals())
        expect(backwards.total()).toBe(forwards.total())
        expect(forwards.countOf(cell('opv1'))).toBe(5)
    })

    it('never takes a cell below zero, so a tap after too large a correction counts', () => {
        const entries = [
            tapOn('opv1', GIRL),
            correctionOn('opv1', GIRL, -1),
            correctionOn('opv1', GIRL, -1),
            tapOn('opv1', GIRL),
            tapOn('opv1', BOY),
        ]
        const fold = foldOf(entries)
        expect(fold.countOf(cell('opv1'))).toBe(1)
        expect(fold.rowTotals()[2]).toBe(2)
        expect(fold.total()).toBe(2)
        expect(foldOf([...entries].reverse()).counts()).toEqual(fold.counts())
    })

    it('counts each new mark when three devices emptied a cell and two then tapped it', () => {
        const original = tapOn('opv1', GIRL)
        const phoneEmptied = correctionOn('opv1', GIRL, -1)
        const tabletEmptied = correctionOn('opv1', GIRL, -1)
        const laptopEmptied = correctionOn('opv1', GIRL, -1)
        const phoneTap = tapOn('opv1', GIRL, 'phone')
        const laptopTap = tapOn('opv1', GIRL, 'laptop')
        const phone = [original, phoneEmptied, tabletEmptied, phoneTap]
        const laptop = [original, tabletEmptied, laptopEmptied, laptopTap]
        expect(foldOf(phone).countOf(cell('opv1'))).toBe(1)
        expect(foldOf(laptop).countOf(cell('opv1'))).toBe(1)
        const joined = mergeTallyEntries(phone, laptop)
        expect(foldOf(joined).countOf(cell('opv1'))).toBe(2)
        expect(
            foldOf(mergeTallyEntries(laptop, phone).toReversed()).countOf(
                cell('opv1')
            )
        ).toBe(2)
    })

    it('leaves out an entry made for a layout with another category', () => {
        const older = tapOn('opv1', { ...GIRL, status: 'refugee' })
        const fold = foldOf([older, tapOn('opv1', GIRL)])
        expect(fold.countOf(cell('opv1'))).toBe(1)
        expect(fold.unplaced()).toBe(1)
        expect(unplacedTallyEntries(VACCINATIONS, [older])).toEqual([older])
    })

    it('leaves out entries for a row or options the layout does not have, everywhere', () => {
        const entries = [
            tapOn('nothing', GIRL),
            tapOn('opv1', { age: 'under1' }),
            correctionOn('opv1', GIRL, Number.POSITIVE_INFINITY),
            correctionOn('opv1', GIRL, 1.5),
        ]
        const fold = foldOf(entries)
        expect(fold.total()).toBe(0)
        expect(fold.unplaced()).toBe(4)
        expect(counted(entries)).toEqual([])
        expect(unplacedTallyEntries(VACCINATIONS, entries)).toEqual(entries)
        expect(
            unplacedTallyEntries(VACCINATIONS, [
                tapOn('opv1', GIRL),
                undoOf(entries[0] ?? tapOn('opv1', GIRL)),
            ])
        ).toEqual([])
    })

    it('counts a closed cell that a log holds a count for', () => {
        const fold = foldOf([tapOn('bcg', OLDER_GIRL)])
        expect(fold.countOf(cell('bcg', OLDER_GIRL))).toBe(1)
        expect(counted([tapOn('bcg', OLDER_GIRL)])).toEqual([
            { row: 'bcg', options: OLDER_GIRL, count: 1 },
        ])
    })
})

describe('the next undo', () => {
    it('is the latest entry with anything left, corrections included', () => {
        const tap = tapOn('opv1', GIRL)
        const correction = correctionOn('bcg', BOY, 5)
        const fold = foldOf([tap, correction])
        expect(fold.latest()).toEqual([
            { id: correction.id, cell: cell('bcg', BOY) },
        ])
        fold.take([undoOf(correction)])
        expect(fold.latest()).toEqual([{ id: tap.id, cell: cell('opv1') }])
        fold.take([undoOf(tap)])
        expect(fold.latest()).toEqual([])
    })

    it('takes a batch back together', () => {
        const batch = 'done-1'
        const earlier = tapOn('penta1', GIRL)
        const entries: TallyEntry[] = [
            { ...correctionOn('opv1', GIRL, 2), batch },
            { ...correctionOn('bcg', BOY, 3), batch },
        ]
        const fold = foldOf([...entries, earlier])
        expect(fold.latest().map(({ id }) => id)).toEqual(
            entries.map(({ id }) => id)
        )
    })

    it('is the entry made last, not the one that arrived last', () => {
        const morning = tapOn('opv1', GIRL, 'nurse')
        const later = tapOn('bcg', BOY, 'nurse')
        const fold = foldOf([later])
        fold.take([morning])
        expect(fold.latest('nurse')).toEqual([
            { id: later.id, cell: cell('bcg', BOY) },
        ])
        expect(fold.latest()).toEqual([
            { id: later.id, cell: cell('bcg', BOY) },
        ])
        fold.take([undoOf(later)])
        expect(fold.latest('nurse')).toEqual([
            { id: morning.id, cell: cell('opv1') },
        ])
    })

    it('is this device’s own latest entry in a joined log', () => {
        const mine = tapOn('opv1', GIRL, 'tablet')
        const theirs = tapOn('bcg', BOY, 'phone')
        const fold = foldOf(mergeTallyEntries([mine], [theirs]))
        expect(fold.latest('tablet')).toEqual([
            { id: mine.id, cell: cell('opv1') },
        ])
        expect(fold.latest('phone')).toEqual([
            { id: theirs.id, cell: cell('bcg', BOY) },
        ])
        fold.take([undoOf(mine)])
        expect(fold.latest('tablet')).toEqual([])
        expect(fold.latest('phone')).toHaveLength(1)
    })
})

describe('joining logs', () => {
    it('keeps one entry per id, oldest first, whatever order the logs come in', () => {
        const shared = [tapOn('opv1', GIRL), tapOn('opv1', GIRL)]
        const tablet = [...shared, tapOn('bcg', BOY, 'tablet')]
        const phone = [...shared, tapOn('penta1', GIRL, 'phone')]
        const joined = mergeTallyEntries(tablet, phone)
        expect(joined).toHaveLength(4)
        expect(mergeTallyEntries(phone, tablet)).toEqual(joined)
        expect(foldOf(joined).total()).toBe(4)
    })

    it('undoes the right tap after a join', () => {
        const first = tapOn('opv1', GIRL, 'tablet')
        const second = tapOn('opv1', BOY, 'tablet')
        const theirs = tapOn('bcg', GIRL, 'phone')
        const undo = undoOf(second)
        const fold = foldOf(mergeTallyEntries([first, second, undo], [theirs]))
        expect(fold.countOf(cell('opv1', BOY))).toBe(0)
        expect(fold.countOf(cell('bcg'))).toBe(1)
        expect(fold.latest('tablet')).toEqual([
            { id: first.id, cell: cell('opv1') },
        ])
    })
})

describe('what a session adds up to', () => {
    it('is a count for every open cell, zeros included, in sheet order', () => {
        const counts = tallyCounts(VACCINATIONS, [
            tapOn('opv1', GIRL),
            tapOn('bcg', GIRL),
            tapOn('opv1', GIRL),
            correctionOn('penta1', BOY, -3),
        ])
        expect(counts).toHaveLength(16)
        expect(counts.filter(({ count }) => count > 0)).toEqual([
            { row: 'bcg', options: GIRL, count: 1 },
            { row: 'opv1', options: GIRL, count: 2 },
        ])
        expect(counts).toContainEqual({
            row: 'penta1',
            options: BOY,
            count: 0,
        })
        expect(
            counts.some(
                ({ row, options }) => row === 'bcg' && options.age === 'over1'
            )
        ).toBe(false)
    })

    it('says zero for a closed cell once what a log held there is taken back', () => {
        const stray = tapOn('bcg', OLDER_GIRL)
        const closedCount = (entries: readonly TallyEntry[]) =>
            tallyCounts(VACCINATIONS, entries).filter(
                ({ row, options }) =>
                    row === 'bcg' && options.age === OLDER_GIRL.age
            )
        expect(closedCount([])).toEqual([])
        expect(closedCount([stray])).toEqual([
            { row: 'bcg', options: OLDER_GIRL, count: 1 },
        ])
        expect(
            closedCount([stray, correctionOn('bcg', OLDER_GIRL, -1)])
        ).toEqual([{ row: 'bcg', options: OLDER_GIRL, count: 0 }])
        expect(closedCount([undoOf(stray), stray])).toEqual([
            { row: 'bcg', options: OLDER_GIRL, count: 0 },
        ])
    })

    it('says zero for a cell corrected back to nothing', () => {
        const tap = tapOn('opv1', GIRL)
        expect(
            tallyCounts(VACCINATIONS, [tap, correctionOn('opv1', GIRL, -1)])
        ).toContainEqual({ row: 'opv1', options: GIRL, count: 0 })
    })
})

describe('joining logs written at different times', () => {
    it('orders entries by the instant, whatever shape it is written in', () => {
        const at = (instant: string, id: string) => ({
            ...tapOn('opv1', GIRL),
            id,
            at: instant,
        })
        const joined = mergeTallyEntries(
            [at('2026-11-25T09:00:00Z', 'whole')],
            [at('2026-11-25T09:00:00.500Z', 'half')],
            [at('2026-11-25T10:00:00+02:00', 'offset')]
        )
        expect(joined.map(({ id }) => id)).toEqual(['offset', 'whole', 'half'])
    })
})
