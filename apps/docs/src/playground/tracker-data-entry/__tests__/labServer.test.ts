import { ProgramRulesResponseSchema } from '@/components/program-rules/hooks/metadata'
import {
    eventFormSchema,
    eventSchema,
} from '@/components/tracker-data-entry/sources/eventSchemas'
import { registerProgramSchema } from '@/components/tracker-data-entry/register/metadata'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { SOURCES, type Example } from '../labData'
import { answer, type LabRequest, type Payload } from '../labServer'

const server = (example: Example, changes = {}) =>
    answer({ example, rules: true, refuse: false, ...changes })

/** What app-runtime returns for a query: each resource's answer under its name. */
const query = (
    respond: ReturnType<typeof server>,
    requests: Record<string, LabRequest>
) =>
    Object.fromEntries(
        Object.entries(requests).map(([name, request]) => [
            name,
            respond(request),
        ])
    )

const events = (
    respond: ReturnType<typeof server>,
    params: LabRequest['params']
) =>
    z
        .object({
            events: z.array(eventSchema.extend({ program: z.string() })),
        })
        .parse(respond({ resource: 'tracker/events', params })).events

// The block's report schema sits beside code that needs a browser; this is the part of it the block reads.
const importReportSchema = z.object({
    status: z.string(),
    validationReport: z.object({
        errorReports: z.array(
            z.object({
                errorCode: z.string(),
                message: z.string(),
                trackerType: z.string().optional(),
                uid: z.string().optional(),
            })
        ),
    }),
})

const save = (respond: ReturnType<typeof server>, data: Payload) =>
    importReportSchema.parse(respond({ resource: 'tracker', data }, 'create'))

describe('the tracker data entry lab server', () => {
    it('answers an event grid’s form query in the shape the block parses', () => {
        for (const example of ['inpatient', 'person'] as const) {
            const options = SOURCES[example]
            const respond = server(example)
            const form = eventFormSchema.parse(
                query(respond, {
                    program: { resource: 'programs', id: options.programId },
                    events: {
                        resource: 'tracker/events',
                        params: { program: options.programId, pageSize: 50 },
                    },
                    me: { resource: 'me' },
                    systemInfo: { resource: 'system/info' },
                })
            )
            expect(form.events.events.length).toBeGreaterThan(0)
        }
    })

    it('pages the inpatient events newest first', () => {
        const respond = server('inpatient')
        const params = { program: 'eBAyeGv0exc', pageSize: 10 }
        const first = events(respond, params)
        const second = events(respond, { ...params, page: 2 })
        expect(first).toHaveLength(10)
        expect(second).toHaveLength(4)
        expect(first[0]?.occurredAt).toBe('2026-10-30T00:00:00.000')
    })

    it('answers the register’s query in the shape the block parses', () => {
        const respond = server('immunisation')
        const answer = query(respond, {
            program: { resource: 'programs', id: 'ImmReg00001' },
            enrollments: {
                resource: 'tracker/enrollments',
                params: {
                    program: 'ImmReg00001',
                    orgUnits: 'DiszpKrYNg8',
                    enrolledAfter: '2026-10-01',
                    enrolledBefore: '2026-10-31',
                    pageSize: 25,
                },
            },
            me: { resource: 'me' },
            systemInfo: { resource: 'system/info' },
        })
        expect(() => registerProgramSchema.parse(answer.program)).not.toThrow()
        // The register's own schema is beside its loader, which needs a browser; its enrolment part, as it reads it.
        const { enrollments } = z
            .object({
                enrollments: z.array(
                    z.object({
                        trackedEntity: z.string(),
                        enrolledAt: z.string(),
                        attributes: z.array(
                            z.object({
                                attribute: z.string(),
                                value: z.string(),
                            })
                        ),
                        events: z.array(eventSchema),
                    })
                ),
            })
            .parse(answer.enrollments)
        expect(enrollments.map(({ trackedEntity }) => trackedEntity)).toEqual([
            'ImmTei00010',
            'ImmTei00020',
            'ImmTei00030',
            'ImmTei00040',
        ])
        expect(enrollments[0]?.attributes).toHaveLength(4)
    })

    it('serves the rules, or none with rules off', () => {
        const rulesQuery = {
            rules: { resource: 'programRules' },
            variables: { resource: 'programRuleVariables' },
            constants: { resource: 'constants' },
            program: { resource: 'programs', id: 'eBAyeGv0exc' },
            me: { resource: 'me' },
        }
        const on = ProgramRulesResponseSchema.parse(
            query(server('inpatient'), rulesQuery)
        )
        expect(on.rules.programRules.length).toBeGreaterThan(0)
        const off = ProgramRulesResponseSchema.parse(
            query(server('inpatient', { rules: false }), rulesQuery)
        )
        expect(off.rules.programRules).toEqual([])
    })

    it('keeps what an import saves: own fields replaced, values merged, null clearing one', () => {
        const respond = server('inpatient')
        const [held] = events(respond, { events: 'LabInpEv002' })
        const report = save(respond, {
            events: [
                {
                    ...held,
                    status: 'COMPLETED',
                    dataValues: [
                        { dataElement: 'qrur9Dvnyt5', value: '8' },
                        { dataElement: 'oZg33kd9taw', value: null },
                    ],
                },
            ],
        })
        expect(report.validationReport.errorReports).toEqual([])
        const [saved] = events(respond, { events: 'LabInpEv002' })
        expect(saved?.status).toBe('COMPLETED')
        const values = Object.fromEntries(
            saved?.dataValues.map(({ dataElement, value }) => [
                dataElement,
                value,
            ]) ?? []
        )
        expect(values.qrur9Dvnyt5).toBe('8')
        expect(values.oZg33kd9taw).toBeUndefined()
        expect(values.vV9UWAZohSf).toBeDefined()
    })

    it('refuses the one row, and saves the rest of the import', () => {
        const respond = server('inpatient', { refuse: true })
        const sent = events(respond, { events: 'LabInpEv001,LabInpEv003' })
        const report = save(respond, { events: sent })
        expect(report.status).toBe('OK')
        expect(
            report.validationReport.errorReports.map(({ uid }) => uid)
        ).toEqual(['LabInpEv001'])
    })

    it('refuses every record of the register’s refused row, new events included', () => {
        const respond = server('immunisation', { refuse: true })
        const report = save(respond, {
            events: [
                {
                    event: 'NewEvent001',
                    program: 'ImmReg00001',
                    programStage: 'ImmVaccin01',
                    orgUnit: 'DiszpKrYNg8',
                    enrollment: 'ImmEnr00010',
                    occurredAt: '2026-10-30',
                    status: 'ACTIVE',
                    dataValues: [],
                },
            ],
        })
        expect(
            report.validationReport.errorReports.map(({ uid }) => uid)
        ).toEqual(['NewEvent001'])
    })

    it('starts each run afresh', () => {
        const first = server('inpatient')
        const [held] = events(first, { events: 'LabInpEv002' })
        save(first, { events: [{ ...held, status: 'COMPLETED' }] })
        const [fresh] = events(server('inpatient'), { events: 'LabInpEv002' })
        expect(fresh?.status).toBe('ACTIVE')
    })
})
