import { describe, expect, it } from 'vitest'
import { STORED_AREA } from '../labData'
import { captureOf, initialLabState, labReducer } from '../labState'
import { PRESETS } from '../presets'

describe('the location lab state', () => {
    it('names each preset once, as a link finds it by name', () => {
        const names = PRESETS.map(({ name }) => name)
        expect(new Set(names).size).toBe(names.length)
    })

    it('opens on the linked preset, or the first', () => {
        expect(initialLabState().preset).toBe(PRESETS[0]?.name)
        const stored = initialLabState('Stored area')
        expect(stored.settings.capture).toBe('area')
        expect(stored.value).toEqual(STORED_AREA)
    })

    it('holds a multi-polygon stage’s area as a multi-polygon of one part', () => {
        const multi = initialLabState('Multi-polygon stage')
        expect(multi.value?.type).toBe('MultiPolygon')
        expect(captureOf(multi.settings)).toBe('area')
        expect(captureOf(initialLabState('No location').settings)).toBe(
            undefined
        )
    })

    it('keeps what was entered when only the look changes, and starts over otherwise', () => {
        const entered = labReducer(initialLabState(), {
            type: 'changed',
            value: { type: 'Point', coordinates: [-11.4, 8.1] },
        })
        expect(entered.callbacks[0]).toContain('"type":"Point"')
        const looked = labReducer(entered, {
            type: 'changeSettings',
            changes: { tiles: 'none' },
        })
        expect(looked.value).toEqual(entered.value)
        expect(looked.run).toBe(entered.run)
        expect(looked.preset).toBeUndefined()
        const other = labReducer(looked, {
            type: 'changeSettings',
            changes: { capture: 'area' },
        })
        expect(other.value).toBeNull()
        expect(other.run).toBe(entered.run + 1)
    })
})
