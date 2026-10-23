import { buildRecord, buildRelationships } from '../buildRecord'
import type { RecordSources } from '../programState'
import type { PersonResponse } from '../schemas'
import type { ProgramRecord, TrackedEntityRecord } from '../types'
import { comparableRecord } from './comparableRecord'
import {
    loadFixtures,
    P1,
    P2,
    PRG_ONCE,
    PRG_OPEN,
    PRG_PROTECTED,
    sourcesFor,
    withProgram,
    type FixtureVersion,
} from './loadFixtures'

const v42 = loadFixtures('v42')

const enrolledIn = (record: TrackedEntityRecord, programId: string) => {
    const state = record.programs.get(programId)
    if (state?.status !== 'enrolled') {
        throw new Error(`${programId} is ${state?.status ?? 'missing'}`)
    }
    return state
}

const infoOf = (state: ProgramRecord | undefined) =>
    state?.status === 'enrolled' || state?.status === 'not-enrolled'
        ? state.program
        : undefined

type EnrollmentResponse = PersonResponse['enrollments'][number]
type EventResponse = EnrollmentResponse['events'][number]

const withEnrollment = (
    person: PersonResponse,
    enrollmentId: string,
    edit: (enrollment: EnrollmentResponse) => EnrollmentResponse
): PersonResponse => ({
    ...person,
    enrollments: person.enrollments.map((enrollment) =>
        enrollment.enrollment === enrollmentId ? edit(enrollment) : enrollment
    ),
})

const eventFor = (event: string, dates: Partial<EventResponse>) => ({
    event,
    program: PRG_OPEN,
    programStage: 'TrE2eStg001',
    enrollment: 'TrE2eEnr002',
    status: 'SCHEDULE',
    createdAt: '2026-01-01T00:00:00.000',
    updatedAt: '2026-01-01T00:00:00.000',
    orgUnit: 'DiszpKrYNg8',
    dataValues: [],
    notes: [],
    occurredAt: undefined,
    scheduledAt: undefined,
    completedAt: undefined,
    geometry: undefined,
    ...dates,
})

describe('buildRecord', () => {
    it('maps the person, merging type and program attributes', () => {
        const { person } = buildRecord(sourcesFor(v42, 'P1'))

        expect(person.id).toBe(P1)
        expect(person.orgUnit).toBe('DiszpKrYNg8')
        expect(person.inactive).toBe(false)
        expect(person.trackedEntityType.id).toBe('TrE2eTet001')
        expect(person.trackedEntityType.name).toBe('TER Person')
        expect(
            person.trackedEntityType.attributes.map(({ id, displayInList }) => [
                id,
                displayInList,
            ])
        ).toEqual([
            ['TrE2eAtt001', true],
            ['TrE2eAtt003', false],
        ])
        expect(person.trackedEntityType.attributes[0]?.name).toBe('First name')
        expect([...person.attributes]).toEqual([
            ['TrE2eAtt001', 'Amara'],
            ['TrE2eAtt002', 'PID-0001'],
            ['TrE2eAtt003', '1990-04-12'],
        ])
    })

    it('maps program metadata, with display labels and attributes in sortOrder', () => {
        const program = enrolledIn(
            buildRecord(sourcesFor(v42, 'P1')),
            PRG_OPEN
        ).program

        expect(program).toMatchObject({
            id: PRG_OPEN,
            name: 'TER E2E open program',
            accessLevel: 'OPEN',
            onlyEnrollOnce: false,
            enrollmentDateLabel: 'Date of registration',
            incidentDateLabel: 'Date of first symptom',
            owner: 'DiszpKrYNg8',
        })
        expect(program.attributes.map((attribute) => attribute.id)).toEqual([
            'TrE2eAtt001',
            'TrE2eAtt002',
        ])
        const stage = program.stages[0]
        expect(
            [...(stage?.dataElements.values() ?? [])].map(
                ({ id, displayInReports }) => [id, displayInReports]
            )
        ).toEqual([
            ['TrE2eDe0001', true],
            ['TrE2eDe0002', false],
        ])
    })

    it("keeps an enrollment's attributes to its program's attributes", () => {
        const record = buildRecord(sourcesFor(loadFixtures('v41'), 'P1'))
        const { enrollments } = enrolledIn(record, PRG_ONCE)

        expect([...(enrollments[0]?.attributes ?? [])]).toEqual([
            ['TrE2eAtt001', 'Amara'],
        ])
    })

    it('hides Stg002 and has no Stg002 events', () => {
        const prg001 = enrolledIn(buildRecord(sourcesFor(v42, 'P1')), PRG_OPEN)

        expect(prg001.program.stages.map((stage) => stage.id)).toEqual([
            'TrE2eStg001',
        ])
        const stages = prg001.enrollments.flatMap((enrollment) =>
            enrollment.events.map((event) => event.programStage)
        )
        expect(stages.length).toBeGreaterThan(0)
        expect(new Set(stages)).toEqual(new Set(['TrE2eStg001']))
    })

    it('drops an event of an unreadable stage if the server ever sends one', () => {
        const sources = sourcesFor(v42, 'P1')
        const person = withEnrollment(
            sources.person,
            'TrE2eEnr002',
            (enrollment) => ({
                ...enrollment,
                events: [
                    ...enrollment.events,
                    eventFor('TrE2eEvtX02', {
                        programStage: 'TrE2eStg002',
                        status: 'ACTIVE',
                        occurredAt: '2025-08-01T00:00:00.000',
                    }),
                ],
            })
        )

        const prg001 = enrolledIn(buildRecord({ ...sources, person }), PRG_OPEN)

        expect(
            prg001.enrollments
                .flatMap((enrollment) => enrollment.events)
                .map((event) => event.event)
        ).not.toContain('TrE2eEvtX02')
    })

    it('stage canWrite needs stage and program write', () => {
        const base = sourcesFor(v42, 'P1')
        const canWrite = (sources: RecordSources) => {
            const state = enrolledIn(buildRecord(sources), PRG_OPEN)
            return [state.access.canWrite, state.program.stages[0]?.canWrite]
        }

        expect(canWrite(base)).toEqual([true, true])
        expect(
            canWrite({
                ...base,
                programs: withProgram(v42.programs, PRG_OPEN, (program) => ({
                    ...program,
                    programStages: program.programStages.map((stage) => ({
                        ...stage,
                        access: { data: { read: true, write: false } },
                    })),
                })),
            })
        ).toEqual([true, false])
        expect(
            canWrite({
                ...base,
                programs: withProgram(v42.programs, PRG_OPEN, (program) => ({
                    ...program,
                    access: { data: { read: true, write: false } },
                })),
            })
        ).toEqual([false, false])
        expect(
            canWrite({
                ...base,
                trackedEntityType: {
                    ...v42.trackedEntityType,
                    access: { data: { read: true, write: false } },
                },
            })
        ).toEqual([false, false])
    })

    it('everything read-only for an inactive person', () => {
        const record = buildRecord({
            ...sourcesFor(v42, 'P2'),
            requestedPrograms: [PRG_OPEN, PRG_ONCE],
        })

        expect(record.person.id).toBe(P2)
        expect(record.person.inactive).toBe(true)
        expect([...record.programs.values()].map((s) => s.status)).toEqual([
            'enrolled',
            'not-enrolled',
        ])
        for (const state of record.programs.values()) {
            if (
                state.status !== 'enrolled' &&
                state.status !== 'not-enrolled'
            ) {
                throw new Error(`unexpected ${state.status}`)
            }
            expect(state.access.canWrite).toBe(false)
            expect(state.program.stages.length).toBeGreaterThan(0)
            for (const stage of state.program.stages) {
                expect(stage.canWrite).toBe(false)
            }
        }
    })

    it('orders programs as requested', () => {
        const record = buildRecord({
            ...sourcesFor(v42, 'P1'),
            requestedPrograms: [PRG_PROTECTED, 'TrE2ePrg999', PRG_OPEN],
        })

        expect([...record.programs.keys()]).toEqual([
            PRG_PROTECTED,
            'TrE2ePrg999',
            PRG_OPEN,
        ])
        expect(record.programs.get('TrE2ePrg999')?.status).toBe('unavailable')
        // Prg002 has a visible enrollment but wasn't asked for.
        expect(record.programs.has(PRG_ONCE)).toBe(false)
    })

    it('lists programOwners programs without the prop', () => {
        const sources = sourcesFor(v42, 'P1')
        const person: PersonResponse = {
            ...sources.person,
            programOwners: [
                ...sources.person.programOwners,
                { program: 'TrE2ePrg999', orgUnit: 'DiszpKrYNg8' },
            ],
        }

        const record = buildRecord({ ...sources, person })

        // Metadata name order: enroll-once, open, protected.
        expect([...record.programs.keys()]).toEqual([
            PRG_ONCE,
            PRG_OPEN,
            PRG_PROTECTED,
        ])
        expect(
            [...record.programs.values()].map((state) => state.status)
        ).toEqual(['enrolled', 'enrolled', 'unavailable'])
    })

    it('has every program as error when the programs request failed', () => {
        const error = new Error('programs failed')
        const record = buildRecord({
            ...sourcesFor(v42, 'P1'),
            programsError: { error, retry: () => {} },
        })

        expect([...record.programs.keys()]).toEqual([
            PRG_OPEN,
            PRG_ONCE,
            PRG_PROTECTED,
        ])
        for (const state of record.programs.values()) {
            expect(state).toMatchObject({ status: 'error', error })
        }
    })

    it('drops empty attribute values', () => {
        const sources = sourcesFor(v42, 'P1')
        const emptied = withEnrollment(
            {
                ...sources.person,
                attributes: [
                    { attribute: 'TrE2eAtt001', value: 'Amara' },
                    { attribute: 'TrE2eAtt003', value: '' },
                ],
            },
            'TrE2eEnr002',
            (enrollment) => ({
                ...enrollment,
                attributes: [
                    { attribute: 'TrE2eAtt001', value: '' },
                    { attribute: 'TrE2eAtt002' },
                ],
                events: enrollment.events.map((event) =>
                    event.event === 'TrE2eEvt002'
                        ? {
                              ...event,
                              dataValues: [
                                  { dataElement: 'TrE2eDe0001', value: '' },
                                  { dataElement: 'TrE2eDe0002', value: 'X' },
                              ],
                          }
                        : event
                ),
            })
        )
        const person = withEnrollment(emptied, 'TrE2eEnr001', (enrollment) => ({
            ...enrollment,
            attributes: [],
        }))

        const record = buildRecord({ ...sources, person })

        expect([...record.person.attributes]).toEqual([
            ['TrE2eAtt001', 'Amara'],
        ])
        const enrollment = enrolledIn(record, PRG_OPEN).enrollments[0]
        expect(enrollment?.attributes.size).toBe(0)
        const event = enrollment?.events.find((e) => e.event === 'TrE2eEvt002')
        expect([...(event?.dataValues ?? [])]).toEqual([['TrE2eDe0002', 'X']])
    })

    it('leaves out a data value with no value key', () => {
        const enrollment = enrolledIn(
            buildRecord(sourcesFor(v42, 'P1')),
            PRG_OPEN
        ).enrollments[0]
        const event = enrollment?.events.find((e) => e.event === 'TrE2eEvt003')

        expect([...(event?.dataValues ?? [])]).toEqual([
            ['TrE2eDe0002', 'MILD'],
        ])
    })

    it('sorts events without occurredAt by scheduledAt, then createdAt', () => {
        const fromFixture = enrolledIn(
            buildRecord(sourcesFor(v42, 'P1')),
            PRG_OPEN
        ).enrollments[0]

        expect(fromFixture?.events.map((event) => event.event)).toEqual([
            'TrE2eEvt005', // scheduled 2090-06-01
            'TrE2eEvt006', // skipped, scheduled 2025-11-01
            'TrE2eEvt004', // scheduled 2025-10-01
            'TrE2eEvt003', // occurred 2025-09-10
            'TrE2eEvt002', // occurred 2025-07-15
            'TrE2eEvt001', // occurred 2025-06-01
        ])

        const sources = sourcesFor(v42, 'P1')
        const person = withEnrollment(
            sources.person,
            'TrE2eEnr002',
            (enrollment) => ({
                ...enrollment,
                events: [
                    eventFor('Older', {
                        scheduledAt: '2025-12-01T00:00:00.000',
                        createdAt: '2025-01-01T00:00:00.000',
                    }),
                    eventFor('Undated', {}),
                    eventFor('Newer', {
                        scheduledAt: '2025-12-01T00:00:00.000',
                        createdAt: '2025-02-01T00:00:00.000',
                    }),
                    eventFor('Occurred', {
                        status: 'ACTIVE',
                        occurredAt: '2025-12-01T00:00:00.000',
                        createdAt: '2025-01-15T00:00:00.000',
                    }),
                ],
            })
        )
        const handBuilt = enrolledIn(
            buildRecord({ ...sources, person }),
            PRG_OPEN
        ).enrollments[0]

        expect(handBuilt?.events.map((event) => event.event)).toEqual([
            'Newer',
            'Occurred',
            'Older',
            'Undated',
        ])
    })

    it('sorts enrollments newest enrolledAt first whatever the API order', () => {
        for (const version of ['v41', 'v42', 'v43'] as const) {
            const record = buildRecord(sourcesFor(loadFixtures(version), 'P1'))
            expect(
                enrolledIn(record, PRG_OPEN).enrollments.map(({ id }) => id)
            ).toEqual(['TrE2eEnr002', 'TrE2eEnr001'])
        }
    })

    describe('builds the same record from v41, v42 and v43 fixtures', () => {
        const build = (version: FixtureVersion, person: 'P1' | 'P2' | 'P3') =>
            comparableRecord(
                buildRecord(sourcesFor(loadFixtures(version), person))
            )

        it.each([
            ['v41', 'P1'],
            ['v43', 'P1'],
            ['v41', 'P2'],
            ['v43', 'P2'],
            ['v41', 'P3'],
            ['v43', 'P3'],
        ] as const)('%s %s equals v42', (version, person) => {
            expect(build(version, person)).toEqual(build('v42', person))
        })

        it('keeps the completed enrollment completedAt on every version', () => {
            for (const version of ['v41', 'v42', 'v43'] as const) {
                const record = buildRecord(
                    sourcesFor(loadFixtures(version), 'P1')
                )
                expect(
                    enrolledIn(record, PRG_OPEN).enrollments[1]?.completedAt
                ).toBeDefined()
            }
        })
    })

    it('passes the relationships result through', () => {
        const retry = () => {}
        const error = new Error('relationships failed')
        const record = buildRecord({
            ...sourcesFor(v42, 'P1'),
            relationships: { status: 'error', error, retry },
        })

        expect(record.relationships).toEqual({ status: 'error', error, retry })
        expect(infoOf(record.programs.get(PRG_OPEN))?.id).toBe(PRG_OPEN)
    })
})

describe('buildRelationships', () => {
    it("gives P1 one relationship to P2 with direction from and the type's names", () => {
        const relationships = buildRelationships(
            P1,
            v42.relationships,
            v42.relationshipTypes
        )

        expect(relationships).toEqual([
            {
                id: 'TrE2eRel001',
                type: {
                    id: 'TrE2eRlt001',
                    name: 'TER E2E sibling',
                    fromToName: 'Sibling of',
                    toFromName: 'Sibling of',
                    bidirectional: true,
                },
                direction: 'from',
                other: {
                    trackedEntity: P2,
                    enrollment: undefined,
                    event: undefined,
                    attributes: new Map([
                        ['TrE2eAtt001', 'Bea'],
                        ['TrE2eAtt002', 'PID-0002'],
                        ['TrE2eAtt003', '2015-02-02'],
                    ]),
                },
                createdAt: '2026-10-23T12:56:53.270',
            },
        ])
    })

    it('gives the from side as other when the person is on the to side', () => {
        const [relationship] = buildRelationships(
            P2,
            v42.relationships,
            v42.relationshipTypes
        )

        expect(relationship?.direction).toBe('to')
        expect(relationship?.other.trackedEntity).toBe(P1)
        expect(relationship?.other.attributes?.get('TrE2eAtt001')).toBe('Amara')
    })

    it('reads an enrollment or event on the other side', () => {
        const [relationship] = buildRelationships(
            P1,
            {
                relationships: [
                    {
                        relationship: 'Rel',
                        relationshipType: 'TrE2eRlt001',
                        createdAt: '2026-01-01T00:00:00.000',
                        from: {
                            trackedEntity: undefined,
                            enrollment: undefined,
                            event: { event: 'Evt' },
                        },
                        to: {
                            trackedEntity: {
                                trackedEntity: P1,
                                attributes: [],
                            },
                            enrollment: undefined,
                            event: undefined,
                        },
                    },
                ],
            },
            v42.relationshipTypes
        )

        expect(relationship?.direction).toBe('to')
        expect(relationship?.other).toEqual({
            trackedEntity: undefined,
            enrollment: undefined,
            event: 'Evt',
            attributes: undefined,
        })
    })

    it('names an unknown type by its id', () => {
        const [relationship] = buildRelationships(P1, v42.relationships, {
            relationshipTypes: [],
        })

        expect(relationship?.type).toEqual({
            id: 'TrE2eRlt001',
            name: 'TrE2eRlt001',
            fromToName: 'TrE2eRlt001',
            toFromName: undefined,
            bidirectional: false,
        })
    })
})
