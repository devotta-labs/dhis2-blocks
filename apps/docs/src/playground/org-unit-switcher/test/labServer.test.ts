import {
    ByIdSchema,
    MeSchema,
    SearchSchema,
} from '@/components/org-unit-switcher/api/schemas'
import { describe, expect, it } from 'vitest'
import {
    districtOrgUnitId,
    districtId,
    flatOrgUnitId,
    generateLabData,
    type LabSettings,
} from '../labData'
import { answer } from '../labServer'
import { DEFAULT_SETTINGS } from '../presets'

const settings = (changes: Partial<LabSettings> = {}) => ({
    ...DEFAULT_SETTINGS,
    ...changes,
})

const me = (changes: Partial<LabSettings> = {}) =>
    MeSchema.parse(
        answer(settings(changes))({
            resource: 'me',
            params: {
                fields: 'id,organisationUnits[id,displayName,path,children::isNotEmpty]',
            },
        })
    )

const search = (query: string, changes: Partial<LabSettings> = {}) => {
    const raw = answer(settings(changes))({
        resource: 'organisationUnits',
        params: {
            query,
            withinUserHierarchy: true,
            fields: 'id,displayName,path',
            pageSize: 50,
        },
    })
    return { raw, parsed: SearchSchema.parse(raw) }
}

const byId = (ids: string[], changes: Partial<LabSettings> = {}) =>
    ByIdSchema.parse(
        answer(settings(changes))({
            resource: 'organisationUnits',
            params: {
                filter: `id:in:[${ids.join(',')}]`,
                withinUserHierarchy: true,
                fields: 'id,displayName,path',
                paging: false,
            },
        })
    )

const UID = /^[A-Za-z][A-Za-z0-9]{10}$/

describe('the organisation unit switcher lab server', () => {
    it('lists exactly the assigned units, with children true for districts only', () => {
        const { userId, assigned } = me({
            assignedOrgUnits: 2,
            assignedDistricts: 1,
            orgUnitsPerDistrict: 5,
        })
        expect(UID.test(userId)).toBe(true)
        expect(assigned.map(({ id }) => id).sort()).toEqual(
            [flatOrgUnitId(1), flatOrgUnitId(2), districtId(1)].sort()
        )
        expect(
            Object.fromEntries(assigned.map((a) => [a.id, a.hasChildren]))
        ).toEqual({
            [flatOrgUnitId(1)]: false,
            [flatOrgUnitId(2)]: false,
            [districtId(1)]: true,
        })
        expect(assigned.every(({ id }) => UID.test(id))).toBe(true)
    })

    it('assigns nothing when the settings assign nothing', () => {
        expect(
            me({ assignedOrgUnits: 0, assignedDistricts: 0 }).assigned
        ).toEqual([])
    })

    it('matches a query, ignoring case, only inside the assigned subtrees', () => {
        const scoped = settings({
            assignedOrgUnits: 0,
            assignedDistricts: 1,
            orgUnitsPerDistrict: 40,
        })
        const inside = generateLabData(scoped).units.filter((unit) =>
            unit.path.includes(`/${districtId(1)}/`)
        )
        const { parsed } = search('CHC', scoped)
        expect(parsed.orgUnits.length).toBeGreaterThan(0)
        expect(
            parsed.orgUnits.every((orgUnit) =>
                inside.some((unit) => unit.id === orgUnit.id)
            )
        ).toBe(true)
        expect(
            parsed.orgUnits.every((orgUnit) =>
                orgUnit.displayName.toLowerCase().includes('chc')
            )
        ).toBe(true)
    })

    it('reports the true total but sends at most a page of matches', () => {
        const { raw, parsed } = search('mchp', {
            assignedOrgUnits: 0,
            assignedDistricts: 3,
            orgUnitsPerDistrict: 200,
        })
        expect(parsed.orgUnits).toHaveLength(50)
        expect(parsed.hasMore).toBe(true)
        expect(raw).toMatchObject({ pager: { total: 150 } })
    })

    it('drops an id outside the assigned subtrees, or that no unit has, from the validity check', () => {
        const ids = [flatOrgUnitId(1), districtOrgUnitId(2, 1), 'labGone0001']
        expect(
            byId(ids, { orgUnitsPerDistrict: 5 }).map(({ id }) => id)
        ).toEqual([flatOrgUnitId(1)])
    })

    it('gives every name 120 characters when asked, and keeps short names short', () => {
        const long = me({ longNames: true, assignedDistricts: 1 }).assigned
        expect(
            long.every(({ displayName }) => displayName.length === 120)
        ).toBe(true)
        expect(
            long.every(
                ({ displayShortName = '' }) =>
                    displayShortName.length > 0 && displayShortName.length <= 50
            )
        ).toBe(true)
    })

    it('fails the search alone, or the validity check alone, with a 500', () => {
        const outcome = (run: () => object) => {
            try {
                run()
                return 'answered'
            } catch (error) {
                return error instanceof Error ? error.message : 'threw'
            }
        }
        const failed = 'Internal server error'
        const both = (changes: Partial<LabSettings>) => [
            outcome(() => search('chc', changes)),
            outcome(() => byId([flatOrgUnitId(1)], changes)),
            outcome(() => me(changes)),
        ]
        expect(both({ failSearch: true })).toEqual([
            failed,
            'answered',
            'answered',
        ])
        expect(both({ failValidity: true })).toEqual([
            'answered',
            failed,
            'answered',
        ])
    })

    it('fails with the 500 shape app-runtime gives, so the block retries as for real', () => {
        expect(() => search('chc', { failSearch: true })).toThrow(
            expect.objectContaining({
                details: expect.objectContaining({ httpStatusCode: 500 }),
            })
        )
    })
})
