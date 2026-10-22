import { readdirSync, readFileSync } from 'node:fs'
import { z, type ZodType } from 'zod'
import {
    ChangeLogPageSchema,
    EventsPageSchema,
    OrgUnitNamesSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
} from './schemas'

const VERSIONS = ['v41', 'v42', 'v43'] as const

const SCHEMA_BY_FIXTURE = {
    'events-page-1.json': EventsPageSchema,
    'events-page-2.json': EventsPageSchema,
    'events-schedule.json': EventsPageSchema,
    'events-skipped.json': EventsPageSchema,
    'events-overdue.json': EventsPageSchema,
    'tracked-entity.json': TrackedEntitySchema,
    'tracked-entity-changelog.json': ChangeLogPageSchema,
    'event-changelog.json': ChangeLogPageSchema,
    'program-metadata.json': ProgramTimelineMetadataSchema,
    'org-unit-names.json': OrgUnitNamesSchema,
} satisfies Record<string, ZodType>

const fixtureDir = (version: string) =>
    new URL(`./__fixtures__/${version}/`, import.meta.url)

const fixture = (version: string, name: string) =>
    z
        .json()
        .parse(
            JSON.parse(readFileSync(new URL(name, fixtureDir(version)), 'utf8'))
        )

const cases = VERSIONS.flatMap((version) =>
    Object.entries(SCHEMA_BY_FIXTURE).map(
        ([name, schema]) => [version, name, schema] as const
    )
)

describe('recorded fixtures', () => {
    it.each(VERSIONS)('%s has a schema for every recorded file', (version) => {
        expect(readdirSync(fixtureDir(version)).sort()).toEqual(
            Object.keys(SCHEMA_BY_FIXTURE).sort()
        )
    })

    it.each(cases)('%s/%s parses with its schema', (version, name, schema) => {
        expect(schema.safeParse(fixture(version, name)).error).toBeUndefined()
    })
})

describe('EventsPageSchema', () => {
    it.each(VERSIONS)(
        '%s keeps the event fields the timeline reads, as stored',
        (version) => {
            const events = EventsPageSchema.parse(
                fixture(version, 'events-page-2.json')
            )
            const completed = events.find((e) => e.event === 'TlE2eEvt001')

            expect(completed).toMatchObject({
                status: 'COMPLETED',
                program: 'WSGAb5XwJ3Y',
                programStage: 'PUZaKR0Jh2k',
                enrollment: 'TlE2eEnr002',
                orgUnit: 'DiszpKrYNg8',
                occurredAt: '2026-01-15T00:00:00.000',
                scheduledAt: '2026-01-15T00:00:00.000',
                completedBy: 'admin',
                createdBy: {
                    username: 'admin',
                    firstName: 'John',
                    surname: 'Traore',
                },
            })
            expect(completed?.dataValues).toContainEqual({
                dataElement: 'iwNXUX6KYX0',
                value: '3200',
            })
            expect(completed?.notes[0]).toMatchObject({
                note: 'TlE2eNot003',
                value: 'Previous delivery details confirmed.',
            })
        }
    )

    it('accepts the legacy `instances` envelope', () => {
        expect(
            EventsPageSchema.parse({
                instances: [
                    { event: 'e1', programStage: 's1', status: 'ACTIVE' },
                ],
            })
        ).toHaveLength(1)
    })

    it('rejects a body with neither envelope key', () => {
        expect(EventsPageSchema.safeParse({ pager: {} }).success).toBe(false)
    })

    it('drops data values without a value and defaults missing lists', () => {
        const [event] = EventsPageSchema.parse({
            events: [
                {
                    event: 'e1',
                    programStage: 's1',
                    status: 'ACTIVE',
                    dataValues: [
                        { dataElement: 'd1', value: null },
                        { dataElement: 'd2', value: '4' },
                    ],
                },
            ],
        })

        expect(event?.dataValues).toEqual([{ dataElement: 'd2', value: '4' }])
        expect(event?.notes).toEqual([])
    })
})

describe('TrackedEntitySchema', () => {
    it.each(VERSIONS)('%s reads every enrollment with its notes', (version) => {
        const te = TrackedEntitySchema.parse(
            fixture(version, 'tracked-entity.json')
        )

        expect(te.trackedEntity).toBe('TlE2eTei001')
        expect(
            te.enrollments.map((e) => [e.enrollment, e.status]).sort()
        ).toEqual([
            ['TlE2eEnr001', 'COMPLETED'],
            ['TlE2eEnr002', 'ACTIVE'],
        ])
        const active = te.enrollments.find(
            (e) => e.enrollment === 'TlE2eEnr002'
        )
        expect(active).toMatchObject({
            program: 'WSGAb5XwJ3Y',
            enrolledAt: '2026-01-10T00:00:00.000',
            occurredAt: '2025-12-01T00:00:00.000',
        })
        expect(active?.notes[0]).toMatchObject({
            note: 'TlE2eNot002',
            value: 'Referred from the outreach team.',
            createdBy: { username: 'admin' },
        })
    })
})

describe('ChangeLogPageSchema', () => {
    it.each(VERSIONS)(
        '%s reads attribute changes with their user',
        (version) => {
            const rows = ChangeLogPageSchema.parse(
                fixture(version, 'tracked-entity-changelog.json')
            )

            expect(rows).toContainEqual({
                createdAt: expect.any(String),
                createdBy: expect.objectContaining({
                    username: 'admin',
                    firstName: 'John',
                    surname: 'Traore',
                }),
                type: 'UPDATE',
                change: {
                    kind: 'attribute',
                    id: 'w75KJ2mc4zz',
                    previousValue: 'Amina',
                    currentValue: 'Aminata',
                },
            })
            expect(rows.map((row) => row.type)).toEqual(
                expect.arrayContaining(['CREATE', 'UPDATE', 'DELETE'])
            )
        }
    )

    it.each(VERSIONS)('%s reads data value changes', (version) => {
        const rows = ChangeLogPageSchema.parse(
            fixture(version, 'event-changelog.json')
        )

        expect(rows.map((row) => row.change)).toContainEqual({
            kind: 'dataElement',
            id: 'dyYdfamSY2Z',
            previousValue: '13',
        })
    })

    it('reads event field changes (42+)', () => {
        const rows = ChangeLogPageSchema.parse(
            fixture('v42', 'event-changelog.json')
        )

        expect(rows.map((row) => row.change)).toContainEqual({
            kind: 'eventField',
            id: 'occurredAt',
            currentValue: '2026-06-12 00:00:00.000',
        })
    })

    it('skips a row whose change kind it does not know, keeping the rest', () => {
        const user = { username: 'admin' }
        const rows = ChangeLogPageSchema.parse({
            changeLogs: [
                {
                    createdAt: '2026-01-01T00:00:00.000',
                    createdBy: user,
                    type: 'UPDATE',
                    change: { somethingNew: { id: 'x' } },
                },
                {
                    createdAt: '2026-01-01T00:00:00.000',
                    createdBy: user,
                    type: 'CREATE',
                    change: {
                        dataValue: { dataElement: 'd1', currentValue: '1' },
                    },
                },
            ],
        })

        expect(rows).toHaveLength(1)
        expect(rows[0]?.change.id).toBe('d1')
    })
})

describe('ProgramTimelineMetadataSchema', () => {
    it.each(VERSIONS)(
        '%s reads hideDueDate, displayInReports and option sets',
        (version) => {
            const program = ProgramTimelineMetadataSchema.parse(
                fixture(version, 'program-metadata.json')
            )
            const firstVisit = program.programStages.find(
                (stage) => stage.id === 'WZbXY0S00lP'
            )

            expect(firstVisit).toMatchObject({
                displayName: 'First antenatal care visit',
                hideDueDate: false,
                sortOrder: 2,
            })
            expect(
                firstVisit?.programStageDataElements.map((psde) => [
                    psde.dataElement.id,
                    psde.displayInReports,
                ])
            ).toEqual(
                expect.arrayContaining([
                    ['dyYdfamSY2Z', true],
                    [expect.any(String), false],
                ])
            )
            const outcome = program.programStages
                .flatMap((stage) => stage.programStageDataElements)
                .find((psde) => psde.dataElement.id === 'mrVkW9h2Rdp')
            expect(outcome?.dataElement.optionSet?.options[0]).toEqual({
                code: 'Live born',
                displayName: 'Live born',
            })
            expect(
                program.programTrackedEntityAttributes.map(
                    (a) => a.trackedEntityAttribute.id
                )
            ).toContain('w75KJ2mc4zz')
        }
    )

    it('defaults hideDueDate and displayInReports to false when absent', () => {
        const program = ProgramTimelineMetadataSchema.parse({
            id: 'p1',
            displayName: 'P',
            programStages: [
                {
                    id: 's1',
                    displayName: 'S',
                    programStageDataElements: [
                        {
                            dataElement: {
                                id: 'd1',
                                displayName: 'D',
                                valueType: 'TEXT',
                            },
                        },
                    ],
                },
            ],
        })

        expect(program.programStages[0]?.hideDueDate).toBe(false)
        expect(
            program.programStages[0]?.programStageDataElements[0]
                ?.displayInReports
        ).toBe(false)
        expect(program.programTrackedEntityAttributes).toEqual([])
    })
})

describe('OrgUnitNamesSchema', () => {
    it.each(VERSIONS)('%s reads ids and names', (version) => {
        expect(
            OrgUnitNamesSchema.parse(fixture(version, 'org-unit-names.json'))
        ).toContainEqual({ id: 'DiszpKrYNg8', displayName: 'Ngelehun CHC' })
    })
})
