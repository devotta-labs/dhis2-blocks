import { readFileSync } from 'node:fs'
import { z, type ZodType } from 'zod'
import {
    OrgUnitPathsResponseSchema,
    PersonResponseSchema,
    ProgramsResponseSchema,
    RelationshipsResponseSchema,
    RelationshipTypesResponseSchema,
    TrackedEntityTypeResponseSchema,
    UserScopesResponseSchema,
} from '../schemas'

const fixtureSchemas: ReadonlyArray<readonly [string, ZodType]> = [
    ['person-P1.json', PersonResponseSchema],
    ['person-P2.json', PersonResponseSchema],
    ['person-P3.json', PersonResponseSchema],
    ['programs.json', ProgramsResponseSchema],
    ['tracked-entity-type.json', TrackedEntityTypeResponseSchema],
    ['relationships-P1.json', RelationshipsResponseSchema],
    ['relationship-types.json', RelationshipTypesResponseSchema],
    ['user-scopes.json', UserScopesResponseSchema],
    ['org-unit-paths.json', OrgUnitPathsResponseSchema],
]

const readFixture = (version: string, file: string) =>
    z
        .json()
        .parse(
            JSON.parse(
                readFileSync(
                    new URL(`./fixtures/${version}/${file}`, import.meta.url),
                    'utf8'
                )
            )
        )

describe('response schemas', () => {
    describe.each(['v41', 'v42', 'v43'])('%s', (version) => {
        it.each(fixtureSchemas)('parses %s', (file, schema) => {
            const result = schema.safeParse(readFixture(version, file))

            expect(result.success, JSON.stringify(result.error)).toBe(true)
        })
    })

    it('accepts a data value with no value key', () => {
        const person = PersonResponseSchema.parse(
            readFixture('v43', 'person-P1.json')
        )
        const values = person.enrollments.flatMap((enrollment) =>
            enrollment.events.flatMap((event) => event.dataValues)
        )

        expect(values.some((value) => value.value === undefined)).toBe(true)
    })

    it('defaults the flags the API leaves out to false', () => {
        const person = PersonResponseSchema.parse(
            readFixture('v43', 'person-P3.json')
        )

        expect(person.inactive).toBe(false)
        expect(person.potentialDuplicate).toBe(false)
        expect(person.enrollments).toEqual([])
    })

    it('accepts null for a stage, data value or attribute that has none', () => {
        const stage = {
            id: 'S',
            displayName: 'Stage',
            sortOrder: null,
            minDaysFromStart: null,
            access: { data: { read: true, write: true } },
            programStageDataElements: [
                {
                    sortOrder: null,
                    dataElement: {
                        id: 'D',
                        displayName: 'Weight',
                        valueType: 'NUMBER',
                    },
                },
            ],
        }
        const programs = ProgramsResponseSchema.parse({
            programs: [
                {
                    id: 'P',
                    displayName: 'Program',
                    programType: 'WITH_REGISTRATION',
                    accessLevel: 'OPEN',
                    expiryDays: null,
                    completeEventsExpiryDays: null,
                    access: { data: { read: true, write: true } },
                    programStages: [stage],
                    programTrackedEntityAttributes: [
                        {
                            sortOrder: null,
                            trackedEntityAttribute: {
                                id: 'A',
                                displayName: 'Name',
                                valueType: 'TEXT',
                            },
                        },
                    ],
                },
            ],
        })
        const [program] = programs.programs
        expect(program?.programStages[0]?.sortOrder).toBe(0)
        expect(program?.programStages[0]?.minDaysFromStart).toBe(0)
        expect(
            program?.programStages[0]?.programStageDataElements[0]?.sortOrder
        ).toBe(0)
        expect(program?.programTrackedEntityAttributes[0]?.sortOrder).toBe(0)

        const person = PersonResponseSchema.parse({
            ...z
                .record(z.string(), z.json())
                .parse(readFixture('v43', 'person-P3.json')),
            attributes: [{ attribute: 'A', value: null }],
            enrollments: [
                {
                    enrollment: 'E',
                    program: 'P',
                    status: 'ACTIVE',
                    orgUnit: 'O',
                    enrolledAt: '2026-01-01T00:00:00.000',
                    createdAt: '2026-01-01T00:00:00.000',
                    updatedAt: '2026-01-01T00:00:00.000',
                    attributes: [{ attribute: 'A', value: null }],
                    events: [
                        {
                            event: 'V',
                            program: 'P',
                            programStage: 'S',
                            enrollment: 'E',
                            status: 'ACTIVE',
                            orgUnit: 'O',
                            createdAt: '2026-01-01T00:00:00.000',
                            updatedAt: '2026-01-01T00:00:00.000',
                            dataValues: [{ dataElement: 'D', value: null }],
                        },
                    ],
                },
            ],
        })
        expect(person.attributes[0]?.value).toBeUndefined()
        expect(person.enrollments[0]?.attributes[0]?.value).toBeUndefined()
        expect(
            person.enrollments[0]?.events[0]?.dataValues[0]?.value
        ).toBeUndefined()
    })

    it('rejects a person without a tracked entity type', () => {
        const result = PersonResponseSchema.safeParse({
            trackedEntity: 'X',
            orgUnit: 'O',
            createdAt: '2026-01-01T00:00:00.000',
            updatedAt: '2026-01-01T00:00:00.000',
        })

        expect(result.success).toBe(false)
    })

    it('rejects a person response without programOwners', () => {
        // Without owner rows a hidden enrollment would read as not enrolled
        // (spec 7.3), so a missing key must fail rather than default.
        const person = {
            trackedEntity: 'X',
            trackedEntityType: 'T',
            orgUnit: 'O',
            createdAt: '2026-01-01T00:00:00.000',
            updatedAt: '2026-01-01T00:00:00.000',
            attributes: [],
            enrollments: [],
        }

        expect(PersonResponseSchema.safeParse(person).success).toBe(false)
        expect(
            PersonResponseSchema.safeParse({ ...person, programOwners: [] })
                .success
        ).toBe(true)
    })
})
