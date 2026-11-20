import { describe, expect, it } from 'vitest'
import type { RequestLogEntry } from '../../network'
import { generateLabData, valueFor } from '../labData'
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

describe('the organisation unit switcher lab state', () => {
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
        expect(state.seeding.seed).toBeDefined()
        expect(state.requests).toEqual([])

        const plain = labReducer(state, {
            type: 'pickPreset',
            preset: presetNamed('Three clinics'),
        })
        expect(plain.seeding.seed).toBeUndefined()
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
            { type: 'changeSettings', changes: { assignedOrgUnits: 9 } },
        ],
        [
            'the sidebar collapses',
            { type: 'changeSettings', changes: { collapsed: true } },
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
            changes: { assignedOrgUnits: 9 },
        })
        expect(state.preset).toBeUndefined()
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.requests).toEqual([])
    })

    it('keeps the block running and the preset on show when the sidebar collapses, the texts or the value changes', () => {
        for (const changes of [
            { collapsed: true },
            { texts: 'schools' as const },
            { value: 'follows' as const },
            { rtl: true },
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

    it('keeps the block running when a failure is turned off, so its Retry can recover', () => {
        for (const name of [
            'Search fails',
            'Validity check fails',
            'Clinics fail to load',
        ]) {
            const failing = labReducer(withRequest, {
                type: 'pickPreset',
                preset: presetNamed(name),
            })
            const state = labReducer(failing, {
                type: 'changeSettings',
                changes: {
                    failSearch: false,
                    failValidity: false,
                    network: { delay: 50, endpoints: {} },
                },
            })
            expect(state.run).toBe(failing.run)
            expect(state.preset).toBe(name)
            expect(state.settings.failSearch).toBe(false)
            expect(state.settings.failValidity).toBe(false)
            expect(state.settings.network.endpoints).toEqual({})
        }
    })

    it('restarts the block when a failure is turned on', () => {
        for (const changes of [
            { failSearch: true },
            { failValidity: true },
            {
                network: {
                    delay: 50,
                    endpoints: { me: { behaviour: 'fails' as const } },
                },
            },
        ]) {
            expect(
                labReducer(withRequest, { type: 'changeSettings', changes }).run
            ).toBe(withRequest.run + 1)
        }
    })

    it('adopts each pick in place while the host follows picks, and starts over when the value changes', () => {
        const follows = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Controlled host that follows picks'),
        })
        expect(follows.followed).toBeUndefined()
        const adopted = labReducer(follows, {
            type: 'adoptValue',
            id: 'labFlat0001',
        })
        expect(adopted.followed).toBe('labFlat0001')
        expect(adopted.run).toBe(follows.run)
        expect(
            labReducer(adopted, {
                type: 'changeSettings',
                changes: { value: 'valid' },
            }).followed
        ).toBeUndefined()
        expect(labReducer(adopted, { type: 'restart' }).followed).toBe(
            undefined
        )
        expect(
            labReducer(adopted, {
                type: 'changeSettings',
                changes: { collapsed: true },
            }).followed
        ).toBe('labFlat0001')
    })

    it('ignores a pick while the host does not follow picks', () => {
        const ignores = labReducer(withRequest, {
            type: 'pickPreset',
            preset: presetNamed('Controlled host that ignores picks'),
        })
        expect(
            labReducer(ignores, { type: 'adoptValue', id: 'labFlat0001' })
        ).toBe(ignores)
    })

    it('opens on lab data, and keeps the settings when switching to live DHIS2, and restarts', () => {
        expect(initialLabState().mode).toBe('lab')
        const state = labReducer(withRequest, {
            type: 'switchMode',
            mode: 'live',
        })
        expect(state.mode).toBe('live')
        expect(state.settings).toBe(withRequest.settings)
        expect(state.run).toBe(withRequest.run + 1)
        expect(state.requests).toEqual([])
        expect(
            labReducer(state, { type: 'switchMode', mode: 'lab' }).mode
        ).toBe('lab')
    })

    it('drops a value that names a lab clinic when switching to live DHIS2', () => {
        for (const [value, live] of [
            ['valid', 'uncontrolled'],
            ['follows', 'follows'],
        ] as const) {
            const lab = labReducer(withRequest, {
                type: 'changeSettings',
                changes: { value },
            })
            expect(
                labReducer(lab, { type: 'switchMode', mode: 'live' }).settings
                    .value
            ).toBe(live)
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
        expect(folded).toHaveLength(8)
        // PresetControls already heads them Edge cases.
        expect(folded.some(({ group }) => group === 'Edge cases')).toBe(false)
    })

    it.each(PRESETS.map((preset) => [preset.name, preset] as const))(
        '%s seeds only ids its own data has, and the server answers it',
        (_, preset) => {
            const data = generateLabData(preset.settings)
            const seeded =
                preset.seed?.match(/\b[A-Za-z][A-Za-z0-9]{10}\b/g) ?? []
            expect(
                seeded.filter(
                    (id) => !data.units.some((unit) => unit.id === id)
                )
            ).toEqual([])
            // The host's value names a unit of the data.
            const value = valueFor(preset.settings, data)
            if (value !== undefined) {
                expect(data.units.some((unit) => unit.id === value)).toBe(true)
            }

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
