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
