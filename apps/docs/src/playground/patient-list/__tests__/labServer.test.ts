import { describe, expect, it } from 'vitest'
import { PatientListResponseSchema } from '@/components/patient-list/api/schemas'
import {
    ATTRIBUTES,
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    generateWorld,
    type LabConfig,
} from '../labData'
import { createLabServer, parseFilters, type LabRequest } from '../labServer'
import { DEFAULT_CONFIG } from '../presets'

const TODAY = '2026-11-02'

const server = (changes: {
    data?: Partial<LabConfig['data']>
    server?: Partial<LabConfig['server']>
}) =>
    createLabServer(
        { server: { ...DEFAULT_CONFIG.server, ...changes.server } },
        generateWorld({ ...DEFAULT_CONFIG.data, ...changes.data }, TODAY)
    )

type Params = NonNullable<LabRequest['params']>

const ask = (respond: ReturnType<typeof server>, params: Params) =>
    respond({
        resource: 'tracker/trackedEntities',
        params: {
            program: LAB_PROGRAM,
            orgUnits: LAB_ORG_UNIT,
            orgUnitMode: 'SELECTED',
            page: 1,
            pageSize: 500,
            ...params,
        },
    })

const people = (respond: ReturnType<typeof server>, params: Params) =>
    PatientListResponseSchema.parse(ask(respond, params))

const valuesOf = (response: ReturnType<typeof people>, attribute: string) =>
    (response.trackedEntities ?? []).map(
        (person) =>
            person?.attributes?.find((each) => each?.attribute === attribute)
                ?.value
    )

describe('the patient list lab server', () => {
    it('reads escaped filter values', () => {
        expect(
            parseFilters(['a:like:x/:y//z/,w', 'b:ge:1:le:5', 'c:!null'])
        ).toEqual([
            { field: 'a', operator: 'like', value: 'x:y/z,w' },
            { field: 'b', operator: 'ge', value: '1' },
            { field: 'b', operator: 'le', value: '5' },
            { field: 'c', operator: '!null' },
        ])
    })

    it('pages from 1 with the page size asked for', () => {
        const respond = server({ data: { rows: 40 } })
        const first = people(respond, { page: 1, pageSize: 15 })
        const third = people(respond, { page: 3, pageSize: 15 })
        expect(first.trackedEntities).toHaveLength(15)
        expect(first.pager).toEqual({
            page: 1,
            pageSize: 15,
            nextPage: 'next?page=2',
        })
        expect(third.trackedEntities).toHaveLength(10)
        expect(third.pager).toEqual({ page: 3, pageSize: 15 })
    })

    it('filters by attribute and sorts as asked', () => {
        const response = people(server({ data: { rows: 60 } }), {
            filter: [
                `${ATTRIBUTES.gender}:in:Male`,
                `${ATTRIBUTES.firstName}:like:a`,
            ],
            order: `${ATTRIBUTES.firstName}:desc`,
        })
        const names = valuesOf(response, ATTRIBUTES.firstName)
        expect(names.length).toBeGreaterThan(0)
        expect(new Set(valuesOf(response, ATTRIBUTES.gender))).toEqual(
            new Set(['Male'])
        )
        expect(
            names.every((name) => String(name).toLowerCase().includes('a'))
        ).toBe(true)
        expect(names).toEqual(
            [...names].sort((left, right) =>
                String(right).localeCompare(String(left))
            )
        )
    })

    it('finds empty values only when asked', () => {
        const respond = server({ data: { rows: 60 } })
        const empty = people(respond, {
            filter: [`${ATTRIBUTES.gender}:null`],
        })
        const filled = people(respond, {
            filter: [`${ATTRIBUTES.gender}:!null`],
        })
        expect(empty.trackedEntities?.length).toBeGreaterThan(0)
        expect(valuesOf(empty, ATTRIBUTES.gender).every((v) => !v)).toBe(true)
        expect(
            (empty.trackedEntities?.length ?? 0) +
                (filled.trackedEntities?.length ?? 0)
        ).toBe(60)
    })

    it('filters by enrollment status and enrollment date', () => {
        const respond = server({ data: { rows: 100 } })
        const completed = people(respond, {
            enrollmentStatus: 'COMPLETED',
            enrollmentEnrolledAfter: '2026-10-01',
            enrollmentEnrolledBefore: '2026-10-31',
            order: 'enrolledAt:asc',
        })
        const enrollments = (completed.trackedEntities ?? []).map(
            (person) => person?.enrollments?.[0]
        )
        expect(enrollments.length).toBeGreaterThan(0)
        for (const enrollment of enrollments) {
            expect(enrollment?.status).toBe('COMPLETED')
            const day = enrollment?.enrolledAt?.slice(0, 10) ?? ''
            expect(day >= '2026-10-01' && day <= '2026-10-31').toBe(true)
        }
        const days = enrollments.map((each) => each?.enrolledAt ?? '')
        expect(days).toEqual([...days].sort())
    })

    it('reads the 2.41 status parameter', () => {
        const response = people(server({ data: { rows: 40 } }), {
            programStatus: 'CANCELLED',
        })
        expect(
            new Set(
                (response.trackedEntities ?? []).map(
                    (person) => person?.enrollments?.[0]?.status
                )
            )
        ).toEqual(new Set(['CANCELLED']))
    })

    it('lists nobody for another program or organisation unit', () => {
        const respond = server({})
        expect(
            people(respond, { program: 'otherProgr1' }).trackedEntities
        ).toEqual([])
        expect(
            people(respond, { orgUnits: 'otherOrgUn1' }).trackedEntities
        ).toEqual([])
    })

    it('sends everything as stored when it ignores the query', () => {
        const response = people(
            server({ data: { rows: 20 }, server: { query: 'ignored' } }),
            { filter: [`${ATTRIBUTES.gender}:in:Male`], pageSize: 5 }
        )
        expect(response.trackedEntities).toHaveLength(20)
    })

    it('answers 2.41 with instances and the page at the top', () => {
        const response = people(
            server({ data: { rows: 40 }, server: { apiVersion: 41 } }),
            { page: 1, pageSize: 15 }
        )
        expect(response.trackedEntities).toBeUndefined()
        expect(response.instances).toHaveLength(15)
        expect(response.pager).toBeUndefined()
        expect(response.page).toBe(1)
        expect(response.pageSize).toBe(15)
    })

    it('answers malformed with something the block cannot read', () => {
        const respond = server({ server: { response: 'malformed' } })
        expect(
            PatientListResponseSchema.safeParse(ask(respond, {})).success
        ).toBe(false)
    })
})
