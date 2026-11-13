import {
    ByIdSchema,
    MeSchema,
    SearchSchema,
} from '@/components/clinic-selector/api/schemas'
import { describe, expect, it } from 'vitest'
import {
    districtId,
    flatClinicId,
    generateLabData,
    GONE,
    OUTSIDE,
    type LabSettings,
} from '../labData'
import { answer } from '../labServer'
import { DEFAULT_SETTINGS } from '../presets'

const settings = (changes: Partial<LabSettings> = {}): LabSettings => ({
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

describe('the clinic selector lab server', () => {
    it('lists exactly the assigned units, with children true for districts only', () => {
        const { userId, assigned } = me({
            assignedClinics: 2,
            assignedDistricts: 1,
            clinicsPerDistrict: 5,
        })
        expect(UID.test(userId)).toBe(true)
        expect(assigned.map(({ id }) => id).sort()).toEqual(
            [flatClinicId(1), flatClinicId(2), districtId(1)].sort()
        )
        expect(
            Object.fromEntries(assigned.map((a) => [a.id, a.hasChildren]))
        ).toEqual({
            [flatClinicId(1)]: false,
            [flatClinicId(2)]: false,
            [districtId(1)]: true,
        })
        expect(assigned.every(({ id }) => UID.test(id))).toBe(true)
    })

    it('answers a different id for the second user', () => {
        expect(me({ userId: 'u1' }).userId).not.toBe(
            me({ userId: 'u2' }).userId
        )
    })

    it('assigns nothing when the settings assign nothing', () => {
        expect(
            me({ assignedClinics: 0, assignedDistricts: 0 }).assigned
        ).toEqual([])
    })

    it('matches a query, ignoring case, only inside the assigned subtrees', () => {
        const scoped = settings({
            assignedClinics: 0,
            assignedDistricts: 1,
            clinicsPerDistrict: 40,
        })
        const inside = generateLabData(scoped).units.filter((unit) =>
            unit.path.includes(`/${districtId(1)}/`)
        )
        const { parsed } = search('CHC', scoped)
        expect(parsed.clinics.length).toBeGreaterThan(0)
        expect(
            parsed.clinics.every((clinic) =>
                inside.some((unit) => unit.id === clinic.id)
            )
        ).toBe(true)
        expect(
            parsed.clinics.every((clinic) =>
                clinic.displayName.toLowerCase().includes('chc')
            )
        ).toBe(true)
    })

    it('reports the true total but sends at most a page of matches', () => {
        const { raw, parsed } = search('mchp', {
            assignedClinics: 0,
            assignedDistricts: 3,
            clinicsPerDistrict: 200,
        })
        expect(parsed.clinics).toHaveLength(50)
        expect(parsed.hasMore).toBe(true)
        expect(raw).toMatchObject({ pager: { total: 150 } })
    })

    it('drops an id outside the assigned subtrees from the validity check', () => {
        const ids = [flatClinicId(1), OUTSIDE, GONE]
        expect(byId(ids).map(({ id }) => id)).toEqual([flatClinicId(1)])
    })

    it('returns the outside id when told to ignore the scope filter', () => {
        const ids = [flatClinicId(1), OUTSIDE, GONE]
        expect(
            byId(ids, { ignoreScopeFilter: true })
                .map(({ id }) => id)
                .sort()
        ).toEqual([flatClinicId(1), OUTSIDE].sort())
    })

    it('gives every name 120 characters, or a B, when asked', () => {
        const long = me({ longNames: true, assignedDistricts: 1 }).assigned
        expect(
            long.every(({ displayName }) => displayName.length === 120)
        ).toBe(true)
        const bees = generateLabData(
            settings({ sameInitials: true, assignedDistricts: 3 })
        ).units
        expect(
            bees.every(({ displayName }) => displayName.startsWith('B'))
        ).toBe(true)
    })
})
