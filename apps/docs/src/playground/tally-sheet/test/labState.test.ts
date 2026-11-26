import { tallyCounts, type TallyEntry } from '@/components/tally-sheet'
import { describe, expect, it } from 'vitest'
import {
    OTHER_DEVICE,
    OTHER_DEVICE_TAPS,
    openCells,
    SHEETS,
    THIS_DEVICE,
} from '../labData'
import { initialLabState, labReducer } from '../labState'
import { PRESETS } from '../presets'

const presetNamed = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found
}

const tap = (id: string) => {
    const entry: TallyEntry = {
        id,
        at: '2026-11-25T08:00:00.000Z',
        by: THIS_DEVICE,
        kind: 'tap',
        row: 'dose1',
        options: { status: 'refugee' },
    }
    return entry
}

const total = (state: ReturnType<typeof initialLabState>) =>
    tallyCounts(SHEETS[state.settings.sheet].layout, state.log).reduce(
        (sum, { count }) => sum + count,
        0
    )

describe('the tally sheet lab state', () => {
    it('opens on the first preset with an empty log', () => {
        const state = initialLabState()
        expect(state.preset).toBe(PRESETS[0]?.name)
        expect(state.log).toEqual([])
        expect(state.handed).toEqual([])
        expect(state.run).toBe(0)
    })

    it('opens on the linked preset, or the first for a name it does not know', () => {
        expect(initialLabState('Vaccinations').settings.sheet).toBe(
            'vaccinations'
        )
        expect(initialLabState('Nothing like this').preset).toBe(
            PRESETS[0]?.name
        )
    })

    it('restarts on a preset, on a log of its seeded marks', () => {
        const state = labReducer(initialLabState(), {
            type: 'pickPreset',
            preset: presetNamed('Vaccinations'),
        })
        expect(state.run).toBe(1)
        expect(state.log).toHaveLength(40)
        expect(total(state)).toBe(40)
    })

    it('opens a joined preset on two devices’ logs, oldest first', () => {
        const { log } = initialLabState('Joined with a tablet')
        const devices = new Set(log.map(({ by }) => by))
        expect(devices).toEqual(new Set([THIS_DEVICE, OTHER_DEVICE]))
        const times = log.map(({ at }) => at)
        expect(times).toEqual([...times].sort())
    })

    it('changes direction and host delay in place, and restarts on a new sheet or seed', () => {
        const state = initialLabState('Vaccinations')
        const turned = labReducer(state, {
            type: 'changeSettings',
            changes: { rtl: true, hostDelay: 1000 },
        })
        expect(turned.run).toBe(0)
        expect(turned.preset).toBeUndefined()
        expect(turned.log).toBe(state.log)

        const seeded = labReducer(turned, {
            type: 'changeSettings',
            changes: { seeded: 5 },
        })
        expect(seeded.run).toBe(1)
        expect(seeded.log).toHaveLength(5)
        expect(seeded.settings.rtl).toBe(true)
    })

    it('lists the entries handed to onAppend newest first, and stores them for the run they came from', () => {
        const state = initialLabState()
        const handed = labReducer(
            labReducer(state, { type: 'handed', entries: [tap('a')] }),
            { type: 'handed', entries: [tap('b'), tap('c')] }
        )
        expect(handed.handed.map(({ id }) => id)).toEqual(['c', 'b', 'a'])
        expect(handed.log).toEqual([])

        const stored = labReducer(handed, {
            type: 'stored',
            run: 0,
            entries: [tap('a')],
        })
        expect(stored.log.map(({ id }) => id)).toEqual(['a'])

        const late = labReducer(labReducer(stored, { type: 'restart' }), {
            type: 'stored',
            run: 0,
            entries: [tap('b')],
        })
        expect(late.log).toEqual([])
        expect(labReducer(handed, { type: 'clearHanded' }).handed).toEqual([])
    })

    it('appends the second device’s taps on open cells, with new ids each time', () => {
        const state = initialLabState('Vaccinations')
        const once = labReducer(state, {
            type: 'otherDevice',
            now: Date.parse('2026-11-25T09:00:00.000Z'),
        })
        const twice = labReducer(once, {
            type: 'otherDevice',
            now: Date.parse('2026-11-25T09:01:00.000Z'),
        })
        const theirs = twice.log.slice(state.log.length)
        expect(theirs).toHaveLength(OTHER_DEVICE_TAPS * 2)
        expect(new Set(theirs.map(({ id }) => id)).size).toBe(theirs.length)
        expect(theirs.every(({ by }) => by === OTHER_DEVICE)).toBe(true)
        expect(total(twice)).toBe(40 + OTHER_DEVICE_TAPS * 2)
    })

    it('seeds marks only on open cells, up to a hundred thousand', () => {
        const { layout } = SHEETS.vaccinations
        const open = new Set(
            openCells(layout).map(
                ({ row, options }) => `${row} ${options.age} ${options.sex}`
            )
        )
        const { log } = initialLabState('Vaccinations')
        for (const entry of log) {
            if (entry.kind !== 'tap') continue
            expect(
                open.has(
                    `${entry.row} ${entry.options.age} ${entry.options.sex}`
                )
            ).toBe(true)
        }
        expect(initialLabState('100,000 marks').log).toHaveLength(100_000)
    })
})
