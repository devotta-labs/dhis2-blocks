import type { PatientListQuery } from '../types'
import { PATIENT_LIST_FIELDS, toTrackerParams } from './params'

const base: PatientListQuery = {
    program: 'IpHINAT79UW',
    orgUnit: 'DiszpKrYNg8',
    page: 2,
    pageSize: 15,
}

describe('toTrackerParams', () => {
    it('maps the scope, the page and the default order, and asks for the fields', () => {
        expect(toTrackerParams(base, 42)).toEqual({
            program: 'IpHINAT79UW',
            orgUnits: 'DiszpKrYNg8',
            orgUnitMode: 'SELECTED',
            page: 2,
            pageSize: 15,
            order: 'createdAt:desc',
            fields: PATIENT_LIST_FIELDS,
        })
    })

    it('sends the given organisation unit mode', () => {
        expect(
            toTrackerParams({ ...base, orgUnitMode: 'DESCENDANTS' }, 42)
        ).toMatchObject({ orgUnitMode: 'DESCENDANTS' })
    })

    it('joins order entries, and uses the default for an empty order', () => {
        expect(
            toTrackerParams(
                { ...base, order: ['w75KJ2mc4zz:asc', 'createdAt:desc'] },
                42
            ).order
        ).toBe('w75KJ2mc4zz:asc,createdAt:desc')
        expect(toTrackerParams({ ...base, order: [] }, 42).order).toBe(
            'createdAt:desc'
        )
    })

    it('sends filters as an array, and leaves out an empty one', () => {
        const filters = ['w75KJ2mc4zz:like:ami', 'zDhUuAYrxNC:eq:Bangura']
        const params = toTrackerParams({ ...base, filters }, 42)
        expect(params.filter).toEqual(filters)
        expect(params.filter).not.toBe(filters)
        expect(
            toTrackerParams({ ...base, filters: [] }, 42)
        ).not.toHaveProperty('filter')
    })

    it('names the enrollment status parameter by API version', () => {
        const query = { ...base, enrollmentStatus: 'ACTIVE' } as const
        expect(toTrackerParams(query, 42)).toMatchObject({
            enrollmentStatus: 'ACTIVE',
        })
        expect(toTrackerParams(query, 42)).not.toHaveProperty('programStatus')
        expect(toTrackerParams(query, 41)).toMatchObject({
            programStatus: 'ACTIVE',
        })
        expect(toTrackerParams(query, 41)).not.toHaveProperty(
            'enrollmentStatus'
        )
    })

    it('maps the enrollment and incident date bounds', () => {
        expect(
            toTrackerParams(
                {
                    ...base,
                    enrolledAfter: '2024-01-01',
                    enrolledBefore: '2024-01-31',
                    occurredAfter: '2023-12-01',
                    occurredBefore: '2023-12-31',
                },
                41
            )
        ).toMatchObject({
            enrollmentEnrolledAfter: '2024-01-01',
            enrollmentEnrolledBefore: '2024-01-31',
            enrollmentOccurredAfter: '2023-12-01',
            enrollmentOccurredBefore: '2023-12-31',
        })
    })

    it('leaves out undefined values', () => {
        const params = toTrackerParams(
            { ...base, enrollmentStatus: undefined, enrolledAfter: undefined },
            42
        )
        expect(Object.values(params)).not.toContain(undefined)
        expect(params).not.toHaveProperty('enrollmentStatus')
        expect(params).not.toHaveProperty('enrollmentEnrolledAfter')
    })

    it('sends other params as given, without overriding its own keys', () => {
        const params = toTrackerParams(
            {
                ...base,
                enrollmentStatus: 'COMPLETED',
                params: {
                    followUp: 'true',
                    program: 'other',
                    page: '9',
                    orgUnitMode: 'ACCESSIBLE',
                    enrollmentStatus: 'CANCELLED',
                    fields: '*',
                },
            },
            42
        )
        expect(params).toMatchObject({
            followUp: 'true',
            program: 'IpHINAT79UW',
            page: 2,
            orgUnitMode: 'SELECTED',
            enrollmentStatus: 'COMPLETED',
            fields: PATIENT_LIST_FIELDS,
        })
    })

    it('keeps a stable key order', () => {
        const query: PatientListQuery = {
            params: { followUp: 'true' },
            occurredBefore: '2024-02-01',
            enrolledAfter: '2024-01-01',
            enrollmentStatus: 'ACTIVE',
            filters: ['w75KJ2mc4zz:like:ami'],
            order: ['w75KJ2mc4zz:asc'],
            pageSize: 15,
            page: 1,
            orgUnitMode: 'CHILDREN',
            orgUnit: 'DiszpKrYNg8',
            program: 'IpHINAT79UW',
        }
        expect(Object.keys(toTrackerParams(query, 42))).toEqual([
            'program',
            'orgUnits',
            'orgUnitMode',
            'page',
            'pageSize',
            'order',
            'filter',
            'enrollmentStatus',
            'enrollmentEnrolledAfter',
            'enrollmentOccurredBefore',
            'followUp',
            'fields',
        ])
    })
})
