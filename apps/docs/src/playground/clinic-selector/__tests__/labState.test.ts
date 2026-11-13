import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
import { generateLabData, GONE } from '../labData'
import { answer } from '../labServer'
import { initialLabState, labReducer, type LabAction } from '../labState'
import { PRESETS } from '../presets'

const presetNamed = (name: string) => {
    const found = PRESETS.find((preset) => preset.name === name)
    if (!found) throw new Error(`No preset ${name}`)
    return found
}

const REQUEST: RequestLogEntry = {
    id: 1,
    at: '10:00:00',
    started: 0,
    request: { resource: 'me' },
    outcome: 'ok',
}

const withRequest = labReducer(initialLabState(), {
    type: 'logRequests',
    update: (entries) => [...entries, REQUEST],
})

describe('the clinic selector lab state', () => {
    it('opens on Three clinics, or on the linked preset', () => {
        expect(initialLabState().preset).toBe('Three clinics')
        expect(initialLabState('Nothing like this').preset).toBe(
            'Three clinics'
        )
        expect(initialLabState('One clinic').settings).toEqual(
            presetNamed('One clinic').settings
        )
    })

    it('replaces the settings on a preset, restarts and seeds afresh', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('District nurse'),
        })
        expect(state.preset).toBe('District nurse')
        expect(state.settings).toEqual(presetNamed('District nurse').settings)
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.seeding).not.toBe(withRequest.seeding)
        expect(Object.keys(state.seeding.seed)).toEqual(['u1'])
        expect(state.requests).toEqual([])

        const plain = labReducer(state, {
            type: 'pickPreset',
            preset: presetNamed('Three clinics'),
        })
        expect(plain.seeding.seed).toEqual({})
        expect(plain.seeding).not.toBe(state.seeding)
    })

    it('seeds again when the same preset is picked again', () => {
        const state = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Three clinics'),
        })
        expect(state.seeding).not.toBe(withRequest.seeding)
    })

    // The lab writes the seed whenever `seeding` is replaced; anything else replacing it wipes storage before the block reads.
    it.each([
        ['storage is edited by hand', { type: 'editStorage' }],
        [
            'a data setting changes',
            { type: 'changeSettings', changes: { assignedClinics: 9 } },
        ],
        [
            'the sidebar collapses',
            { type: 'changeSettings', changes: { collapsed: true } },
        ],
        [
            'the user switches',
            { type: 'changeSettings', changes: { userId: 'u2' } },
        ],
        ['the block restarts', { type: 'restart' }],
    ] satisfies Array<[string, LabAction]>)(
        'keeps the seeding untouched when %s',
        (_, action) => {
            expect(labReducer(withRequest, action).seeding).toBe(
                withRequest.seeding
            )
        }
    )

    it('restarts the block when a data setting changes, and drops the preset', () => {
        const state = labReducer(withRequest, {
            type: 'changeSettings',
            changes: { assignedClinics: 9 },
        })
        expect(state.preset).toBeUndefined()
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.requests).toEqual([])
    })

    it('keeps the block running and the preset on show when the sidebar collapses, the label or the value changes', () => {
        for (const changes of [
            { collapsed: true },
            { label: 'Facility' as const },
            { value: 'outside' as const },
        ]) {
            const state = labReducer(withRequest, {
                type: 'changeSettings',
                changes,
            })
            expect(state.run).toBe(withRequest.run)
            expect(state.requests).toEqual([REQUEST])
            expect(state.preset).toBe(withRequest.preset)
            expect(state.settings).toMatchObject(changes)
        }
    })

    it('restarts on a hand edit of storage and hides what the example stored', () => {
        const nurse = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('District nurse'),
        })
        expect(nurse.edited).toBe(false)
        const state = labReducer(nurse, { type: 'editStorage' })
        expect(state.run).toBe(nurse.run + 1)
        expect(state.preset).toBeUndefined()
        expect(state.edited).toBe(true)
        expect(
            labReducer(state, {
                type: 'pickPreset',
                preset: presetNamed('District nurse'),
            }).edited
        ).toBe(false)
    })

    it('logs callbacks until cleared', () => {
        const state = labReducer(withRequest, {
            type: 'logCallback',
            entry: 'onValueChange Kasana CHC',
        })
        expect(state.callbacks).toEqual(['onValueChange Kasana CHC'])
        expect(labReducer(state, { type: 'clearCallbacks' }).callbacks).toEqual(
            []
        )
    })

    it('has unique names, and folds the edge cases under kinds of their own', () => {
        expect(new Set(PRESETS.map(({ name }) => name)).size).toBe(
            PRESETS.length
        )
        const folded = PRESETS.filter(({ folded }) => folded)
        expect(folded).toHaveLength(13)
        // PresetControls already heads them Edge cases.
        expect(folded.some(({ group }) => group === 'Edge cases')).toBe(false)
    })

    it.each(PRESETS.map((preset) => [preset.name, preset] as const))(
        '%s seeds only ids its own data has, and the server answers it',
        (name, preset) => {
            const data = generateLabData(preset.settings)
            const seeded = Object.values(preset.seed ?? {}).flatMap(
                (raw) => raw.match(/\b[A-Za-z][A-Za-z0-9]{10}\b/g) ?? []
            )
            const missing = seeded.filter(
                (id) => !data.units.some((unit) => unit.id === id)
            )
            expect(missing).toEqual(
                name === 'Remembered clinic no longer exists'
                    ? [GONE, GONE]
                    : []
            )

            const respond = answer(preset.settings, data)
            expect(respond({ resource: 'me' })).toMatchObject({
                id: data.userId,
            })
            const search = () =>
                respond({
                    resource: 'organisationUnits',
                    params: { query: 'a', pageSize: 50 },
                })
            const check = () =>
                respond({
                    resource: 'organisationUnits',
                    params: {
                        filter: `id:in:[${seeded.join(',')}]`,
                        paging: false,
                    },
                })
            if (preset.settings.failSearch) expect(search).toThrow()
            else expect(search).not.toThrow()
            if (preset.settings.failValidity) expect(check).toThrow()
            else expect(check).not.toThrow()
        }
    )
})
