import { SAVED_VISIT } from '@/components/event-form/__tests__/childVisit'
import { placeReport, reportIn } from '@/components/event-form/lib/importReport'
import {
    heldEventSchema,
    programSchema,
    stageFormOf,
} from '@/components/event-form/lib/metadata'
import { ProgramRulesResponseSchema } from '@/components/program-rules/hooks/metadata'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { EXAMPLES, labEvents, type Example } from '../labData'
import { answer, type LabRequest } from '../labServer'

const serverFor = (example: Example, mayUncomplete = true) =>
    answer({ example, mayUncomplete }, labEvents(example))

const read = (example: Example, resource: string, id?: string) =>
    serverFor(example)({ resource, id }, 'read')

const examples = Object.keys(EXAMPLES).filter(
    (example): example is Example => example in EXAMPLES
)

describe('the event form lab server', () => {
    it.each(examples)(
        '%s: answers a stage form and rules metadata the block parses',
        (example) => {
            const { programId, programStageId } = EXAMPLES[example]
            const program = read(example, 'programs', programId)
            expect(
                stageFormOf(programSchema.parse(program), programStageId)
            ).toBeDefined()
            // The rules of `rulesFail` are only served to fail.
            const source = example === 'rulesFail' ? 'newVisit' : example
            const metadata = ProgramRulesResponseSchema.parse({
                rules: read(source, 'programRules'),
                variables: read(source, 'programRuleVariables'),
                constants: read(source, 'constants'),
                program,
                me: read(source, 'me'),
            })
            expect(metadata.program.id).toBe(programId)
        }
    )

    it.each(examples.filter((example) => EXAMPLES[example].eventId))(
        '%s: answers the held event as the block parses it',
        (example) => {
            const { eventId } = EXAMPLES[example]
            expect(
                heldEventSchema.parse(read(example, 'tracker/events', eventId))
                    .event
            ).toBe(eventId)
        }
    )

    it('answers 404 for another program or event', () => {
        expect(() => read('newVisit', 'programs', 'otherProgrm')).toThrow(
            'not found'
        )
        expect(() => read('newVisit', 'tracker/events', 'otherEvent1')).toThrow(
            'not found'
        )
    })

    it('keeps a save for the next read: own fields replaced, values merged, a null deleting one', () => {
        const respond = serverFor('savedVisit')
        const event = (id: string) =>
            heldEventSchema.parse(
                respond({ resource: 'tracker/events', id }, 'read')
            )
        const held = event('labVisit001')
        const saved = respond(
            {
                resource: 'tracker',
                data: {
                    events: [
                        {
                            ...held,
                            scheduledAt: '2026-11-10T00:00:00.000',
                            dataValues: [
                                { dataElement: 'labWeight01', value: null },
                                { dataElement: 'labTempC001', value: '38' },
                            ],
                        },
                    ],
                },
            },
            'create'
        )
        expect(saved).toMatchObject({
            status: 'OK',
            stats: { created: 0, updated: 1 },
        })
        const after = event('labVisit001')
        expect(after.scheduledAt).toBe('2026-11-10T00:00:00.000')
        const values = Object.fromEntries(
            after.dataValues.map(({ dataElement, value }) => [
                dataElement,
                value,
            ])
        )
        expect(values.labWeight01).toBeUndefined()
        expect(values.labTempC001).toBe('38')
        expect(values.labSexCode1).toBe('F')
    })

    it('adds a sent note once, with the lab user and a time, after the held ones', () => {
        const respond = serverFor('savedVisit')
        const event = () =>
            heldEventSchema.parse(
                respond({ resource: 'tracker/events', id: 'labVisit001' })
            )
        const { notes: stored, ...own } = event()
        expect(stored).toHaveLength(2)
        const data = {
            events: [
                {
                    ...own,
                    notes: [{ note: 'labNoteNew1', value: 'Gave ORS.' }],
                },
            ],
        }
        respond({ resource: 'tracker', data }, 'create')
        respond({ resource: 'tracker', data }, 'create')
        const { notes } = event()
        expect(notes).toHaveLength(3)
        expect(notes[2]).toMatchObject({
            note: 'labNoteNew1',
            value: 'Gave ORS.',
            storedBy: 'labUser0001',
            createdBy: { displayName: 'Lab user' },
            storedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/),
        })
    })

    it('creates a new event, and refuses anything but a create', () => {
        const respond = serverFor('newVisit')
        const data = {
            events: [
                {
                    event: 'labNewEvnt1',
                    program: 'labChildVis',
                    programStage: 'labChildStg',
                    orgUnit: 'labOrgUnit1',
                    occurredAt: '2026-11-12',
                    status: 'ACTIVE',
                    dataValues: [{ dataElement: 'labWeight01', value: '9' }],
                },
            ],
        }
        expect(respond({ resource: 'tracker', data }, 'create')).toMatchObject({
            stats: { created: 1, updated: 0 },
        })
        expect(
            respond({ resource: 'tracker/events', id: 'labNewEvnt1' }, 'read')
        ).toMatchObject({ dataValues: [{ value: '9' }] })
        expect(() => respond({ resource: 'tracker', data }, 'update')).toThrow()
    })

    it('refuses a save with an import report the block places on a field and the form', () => {
        const request: LabRequest = {
            resource: 'tracker',
            data: {
                events: [
                    {
                        event: 'labNewEvnt1',
                        dataValues: [
                            { dataElement: 'labWeight01', value: '12' },
                            { dataElement: 'labSexCode1', value: 'F' },
                        ],
                    },
                ],
            },
        }
        let thrown: unknown
        try {
            serverFor('refused')(request, 'create')
        } catch (error) {
            thrown = error
        }
        const details = z.object({ details: z.json() }).parse(thrown).details
        const report = reportIn(details)
        expect(report?.status).toBe('ERROR')
        const placed = placeReport(
            report ?? { status: '', validationReport: { errorReports: [] } },
            new Map([
                ['labWeight01', 'Weight (kg)'],
                ['labSexCode1', 'Sex'],
            ]),
            new Map(),
            undefined,
            { labWeight01: '12', labSexCode1: 'F' }
        )
        expect(placed.fieldErrors).toEqual(
            new Map([
                [
                    'labSexCode1',
                    [
                        'Value `F` is not a valid option code in OptionSet `labOsSex001`.',
                    ],
                ],
            ])
        )
        expect(placed.formErrors).toEqual([
            'You do not have access to enter data at Ngelehun CHC. (E1000)',
        ])
    })

    describe('a completed event of a stage that blocks entry', () => {
        const update = (status: string) => ({
            resource: 'tracker',
            data: { events: [{ ...SAVED_VISIT, status, dataValues: [] }] },
        })
        const refusal = (
            server: ReturnType<typeof serverFor>,
            status: string
        ) => {
            try {
                server(update(status), 'create')
            } catch (error) {
                return reportIn(
                    z.object({ details: z.json() }).parse(error).details
                )?.validationReport.errorReports
            }
            return undefined
        }

        it('reopens as active for a user who may, keeping its values', () => {
            const server = serverFor('locked')
            expect(refusal(server, 'ACTIVE')).toBeUndefined()
            const held = heldEventSchema.parse(
                server({ resource: 'tracker/events', id: SAVED_VISIT.event })
            )
            expect(held.status).toBe('ACTIVE')
            expect(held.dataValues).toHaveLength(SAVED_VISIT.dataValues.length)
        })

        it('refuses to reopen it for a user who may not, and any other update, as DHIS2 2.42 words it', () => {
            expect(refusal(serverFor('locked', false), 'ACTIVE')).toEqual([
                expect.objectContaining({
                    errorCode: 'E1083',
                    message:
                        'User: `labUser0001`, is not authorized to modify completed events.',
                }),
            ])
            expect(refusal(serverFor('locked'), 'COMPLETED')).toEqual([
                expect.objectContaining({
                    errorCode: 'E1326',
                    message: `Event \`${SAVED_VISIT.event}\` is completed and its ProgramStage blocks the entry form after completion. Reopen the Event before updating.`,
                }),
            ])
        })

        it('answers the user’s authority to reopen', () => {
            expect(serverFor('locked')({ resource: 'me' })).toMatchObject({
                authorities: ['F_UNCOMPLETE_EVENT'],
            })
            expect(
                serverFor('locked', false)({ resource: 'me' })
            ).toMatchObject({
                authorities: [],
            })
        })
    })

    describe('a program with categories', () => {
        const visit = (
            attributeCategoryOptions?: string,
            occurredAt = '2026-11-12'
        ) => ({
            resource: 'tracker',
            data: {
                events: [
                    {
                        event: 'labNewEvnt1',
                        program: 'labChildVis',
                        programStage: 'labChildStg',
                        orgUnit: 'labOrgUnit1',
                        occurredAt,
                        status: 'ACTIVE',
                        attributeCategoryOptions,
                        dataValues: [
                            { dataElement: 'labWeight01', value: '9' },
                        ],
                    },
                ],
            },
        })
        const refusedWith = (request: LabRequest) => {
            let thrown: unknown
            try {
                serverFor('fundedVisit')(request, 'create')
            } catch (error) {
                thrown = error
            }
            return reportIn(
                z.object({ details: z.json() }).parse(thrown).details
            )?.validationReport.errorReports.map(({ errorCode }) => errorCode)
        }

        it('answers the org unit’s path', () => {
            expect(
                read('fundedVisit', 'organisationUnits', 'labOrgUnit1')
            ).toEqual({
                path: '/labCountry1/labDistrct1/labOrgUnit1',
            })
            expect(() =>
                read('fundedVisit', 'organisationUnits', 'otherUnit01')
            ).toThrow('not found')
        })

        it('saves an event with one writable option per category in its dates', () => {
            expect(
                serverFor('fundedVisit')(
                    visit('labCoNgo001,labCoMobile'),
                    'create'
                )
            ).toMatchObject({ status: 'OK', stats: { created: 1 } })
        })

        it('refuses an event without valid category options, as DHIS2 does', () => {
            expect(refusedWith(visit())).toEqual(['E1055'])
            expect(refusedWith(visit('labCoGovt01,nopeOption1'))).toEqual([
                'E1116',
            ])
            expect(refusedWith(visit('labCoGovt01'))).toEqual(['E1117'])
            expect(refusedWith(visit('labCoGovt01,labCoNgo001'))).toEqual([
                'E1117',
            ])
            expect(refusedWith(visit('labCoGovt01,labCoCampgn'))).toEqual([
                'E1099',
            ])
            expect(refusedWith(visit('labCoPilot1,labCoFixed1'))).toEqual([
                'E1057',
            ])
            expect(
                refusedWith(visit('labCoGovt01,labCoMobile', '2025-12-31'))
            ).toEqual(['E1056'])
        })

        it('reads the options comma-separated and accepts one limited to other org units, as DHIS2 2.42 does', () => {
            expect(refusedWith(visit('labCoGovt01;labCoFixed1'))).toEqual([
                'E1116',
            ])
            expect(
                serverFor('fundedVisit')(
                    visit('labCoDonor1,labCoFixed1'),
                    'create'
                )
            ).toMatchObject({ status: 'OK' })
        })

        it('names an option out of its dates by its name, so the block places it on its category', () => {
            let thrown: unknown
            try {
                serverFor('fundedVisit')(
                    visit('labCoPilot1,labCoFixed1'),
                    'create'
                )
            } catch (error) {
                thrown = error
            }
            const report = reportIn(
                z.object({ details: z.json() }).parse(thrown).details
            )
            const placed = placeReport(
                report ?? {
                    status: '',
                    validationReport: { errorReports: [] },
                },
                new Map([['labCatFund1', 'Funding']]),
                new Map([
                    [
                        'Pilot grant',
                        { fieldId: 'labCatFund1', name: 'Pilot grant' },
                    ],
                ])
            )
            expect(placed.fieldErrors.get('labCatFund1')).toEqual([
                'Event date: `2026-11-12` is after end date: `2025-06-30` for AttributeOption: `Pilot grant` in Program: `Child visit`.',
            ])
        })

        it('saves an event of a program with the default combination without them', () => {
            expect(serverFor('newVisit')(visit(), 'create')).toMatchObject({
                status: 'OK',
            })
        })
    })

    it('answers an org unit with the fields asked for: its name and point, or area', () => {
        expect(
            serverFor('pointVisit')(
                {
                    resource: 'organisationUnits',
                    id: 'labOrgUnit1',
                    params: { fields: 'path,displayName,geometry' },
                },
                'read'
            )
        ).toMatchObject({
            displayName: 'Ngelehun CHC',
            geometry: { type: 'Point' },
        })
        expect(
            serverFor('areaVisit')(
                {
                    resource: 'organisationUnits',
                    id: EXAMPLES.areaVisit.orgUnitId,
                    params: { fields: 'path,displayName,geometry' },
                },
                'read'
            )
        ).toMatchObject({
            displayName: 'Badjia',
            geometry: { type: 'Polygon' },
        })
    })

    it('keeps a saved point for the next read, and a null geometry deletes it', () => {
        const respond = serverFor('savedPointVisit')
        const event = () =>
            heldEventSchema.parse(
                respond(
                    { resource: 'tracker/events', id: 'labVisit001' },
                    'read'
                )
            )
        const sent = (
            geometry: { type: 'Point'; coordinates: number[] } | null
        ) =>
            respond(
                {
                    resource: 'tracker',
                    data: {
                        events: [{ ...event(), geometry, dataValues: [] }],
                    },
                },
                'create'
            )
        sent({ type: 'Point', coordinates: [-13.2356, 8.4871] })
        expect(event().geometry).toEqual({
            type: 'Point',
            coordinates: [-13.2356, 8.4871],
        })
        sent(null)
        expect(event()).not.toHaveProperty('geometry')
    })

    it('fails the rules of rulesFail with a server error', () => {
        expect(() => read('rulesFail', 'programRules')).toThrow()
    })

    it('answers stored file names, and its uploads', () => {
        const respond = serverFor('valueTypes')
        expect(
            respond({ resource: 'fileResources', id: 'labFile0001' }, 'read')
        ).toEqual({ id: 'labFile0001', name: 'dhis2-symbol.svg' })
        respond(
            {
                resource: 'fileResources',
                data: { file: new File(['a'], 'letter.pdf') },
            },
            'create'
        )
        expect(
            respond({ resource: 'fileResources', id: 'labUpload01' }, 'read')
        ).toEqual({ id: 'labUpload01', name: 'letter.pdf' })
    })

    it('answers the RMNCH enrolment, and 404 for another', () => {
        expect(
            read('rmnch', 'tracker/enrollments', 'PE6abx7Zhn0')
        ).toMatchObject({ enrollment: 'PE6abx7Zhn0' })
        expect(() =>
            read('newVisit', 'tracker/enrollments', 'labEnrol001')
        ).toThrow('not found')
    })

    it('throws for a resource it does not serve', () => {
        expect(() => read('newVisit', 'dataStore')).toThrow()
    })
})
