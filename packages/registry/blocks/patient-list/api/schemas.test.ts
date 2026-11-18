import { ZodError } from 'zod'
import type { PatientListQuery } from '../types'
import { PatientListResponseSchema, toPatientListPage } from './schemas'

const query: PatientListQuery = {
    program: 'IpHINAT79UW',
    orgUnit: 'DiszpKrYNg8',
    page: 1,
    pageSize: 2,
}

const amina = {
    trackedEntity: 'te01',
    orgUnit: 'DiszpKrYNg8',
    createdAt: '2024-01-02T10:00:00.000',
    updatedAt: '2024-01-03T10:00:00.000',
    inactive: false,
    attributes: [
        { attribute: 'w75KJ2mc4zz', value: 'Amina' },
        { attribute: 'zDhUuAYrxNC', value: 'Bangura' },
    ],
    enrollments: [
        {
            enrollment: 'en01',
            program: 'IpHINAT79UW',
            status: 'ACTIVE',
            enrolledAt: '2024-01-02T00:00:00.000',
            occurredAt: '2024-01-01T00:00:00.000',
            orgUnit: 'DiszpKrYNg8',
        },
    ],
}

const bakary = {
    trackedEntity: 'te02',
    attributes: [{ attribute: 'w75KJ2mc4zz', value: 'Bakary' }],
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

const page = (response: Json, apiVersion = 42) =>
    toPatientListPage(
        PatientListResponseSchema.parse(response),
        query,
        apiVersion
    )

describe('toPatientListPage', () => {
    it('reads the 2.42 form', () => {
        expect(
            page({
                trackedEntities: [amina, bakary],
                pager: { page: 1, pageSize: 2, nextPage: 'https://x/?page=2' },
            })
        ).toEqual({
            rows: [
                {
                    trackedEntity: 'te01',
                    orgUnit: 'DiszpKrYNg8',
                    createdAt: '2024-01-02T10:00:00.000',
                    updatedAt: '2024-01-03T10:00:00.000',
                    inactive: false,
                    attributes: {
                        w75KJ2mc4zz: 'Amina',
                        zDhUuAYrxNC: 'Bangura',
                    },
                    enrollment: {
                        enrollment: 'en01',
                        status: 'ACTIVE',
                        enrolledAt: '2024-01-02T00:00:00.000',
                        occurredAt: '2024-01-01T00:00:00.000',
                        orgUnit: 'DiszpKrYNg8',
                    },
                },
                {
                    trackedEntity: 'te02',
                    inactive: false,
                    attributes: { w75KJ2mc4zz: 'Bakary' },
                },
            ],
            hasNextPage: true,
        })
    })

    it('reads the 2.41 form, with the list under instances', () => {
        const result = page({ instances: [amina], page: 1, pageSize: 2 }, 41)
        expect(result.rows.map((row) => row.trackedEntity)).toEqual(['te01'])
    })

    it('has a next page on 2.42+ only with a nextPage link', () => {
        expect(
            page({ trackedEntities: [amina, bakary], pager: { page: 1 } })
                .hasNextPage
        ).toBe(false)
        expect(page({ trackedEntities: [amina, bakary] }).hasNextPage).toBe(
            false
        )
        expect(
            page({
                trackedEntities: [amina],
                pager: { nextPage: 'https://x/?page=2' },
            }).hasNextPage
        ).toBe(true)
    })

    it('has a next page on 2.41 when the page is full', () => {
        expect(page({ instances: [amina, bakary] }, 41).hasNextPage).toBe(true)
        expect(page({ instances: [amina] }, 41).hasNextPage).toBe(false)
        // A dropped malformed entity still counts toward a full page.
        expect(
            page({ instances: [amina, { attributes: [] }] }, 41).hasNextPage
        ).toBe(true)
    })

    it('reads an empty or missing list as no rows', () => {
        expect(page({ trackedEntities: [] }).rows).toEqual([])
        expect(page({}).rows).toEqual([])
    })

    it('drops tracked entities without an id, and malformed ones', () => {
        const result = page({
            trackedEntities: [
                { attributes: [] },
                { trackedEntity: 42 },
                'not an entity',
                bakary,
            ],
        })
        expect(result.rows.map((row) => row.trackedEntity)).toEqual(['te02'])
    })

    it('loses only a malformed field', () => {
        const [row] = page({
            trackedEntities: [
                {
                    ...amina,
                    createdAt: 7,
                    inactive: 'yes',
                    attributes: [
                        { attribute: 'w75KJ2mc4zz', value: 'Amina' },
                        { attribute: 'zDhUuAYrxNC' },
                        { value: 'orphan' },
                        { attribute: 'aAge0000001', value: 31 },
                        { attribute: 'aFlag000001', value: true },
                        'not an attribute',
                    ],
                },
            ],
        }).rows
        expect(row).toMatchObject({
            trackedEntity: 'te01',
            createdAt: undefined,
            updatedAt: '2024-01-03T10:00:00.000',
            inactive: false,
            attributes: {
                w75KJ2mc4zz: 'Amina',
                aAge0000001: '31',
                aFlag000001: 'true',
            },
        })
        expect(row?.enrollment?.enrollment).toBe('en01')
    })

    it('picks the first enrollment in the program with a known status', () => {
        const [row] = page({
            trackedEntities: [
                {
                    trackedEntity: 'te01',
                    enrollments: [
                        {
                            enrollment: 'other',
                            program: 'otherProgr1',
                            status: 'ACTIVE',
                        },
                        {
                            enrollment: 'unknown',
                            program: 'IpHINAT79UW',
                            status: 'PAUSED',
                        },
                        { program: 'IpHINAT79UW', status: 'ACTIVE' },
                        {
                            enrollment: 'mine',
                            program: 'IpHINAT79UW',
                            status: 'COMPLETED',
                        },
                        {
                            enrollment: 'later',
                            program: 'IpHINAT79UW',
                            status: 'ACTIVE',
                        },
                    ],
                },
            ],
        }).rows
        expect(row?.enrollment).toEqual({
            enrollment: 'mine',
            status: 'COMPLETED',
        })
    })

    it('has no enrollment without one in the program', () => {
        const [row] = page({
            trackedEntities: [
                {
                    trackedEntity: 'te01',
                    enrollments: [
                        {
                            enrollment: 'other',
                            program: 'otherProgr1',
                            status: 'ACTIVE',
                        },
                    ],
                },
            ],
        }).rows
        expect(row?.enrollment).toBeUndefined()
    })

    it('rejects a response that is not an object', () => {
        expect(() => PatientListResponseSchema.parse(null)).toThrow(ZodError)
        expect(() => PatientListResponseSchema.parse('<html>')).toThrow(
            ZodError
        )
    })
})
