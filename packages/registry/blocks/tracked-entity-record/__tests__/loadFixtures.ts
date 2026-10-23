import { readFileSync } from 'node:fs'
import type { ZodType } from 'zod'
import { buildRelationships } from '../buildRecord'
import { toOwnerPaths, toUserScopes, type RecordSources } from '../programState'
import {
    OrgUnitPathsResponseSchema,
    PersonResponseSchema,
    ProgramsResponseSchema,
    RelationshipsResponseSchema,
    RelationshipTypesResponseSchema,
    TrackedEntityTypeResponseSchema,
    UserScopesResponseSchema,
    type OrgUnitPathsResponse,
    type PersonResponse,
    type ProgramsResponse,
    type RelationshipsResponse,
    type RelationshipTypesResponse,
    type TrackedEntityTypeResponse,
    type UserScopesResponse,
} from '../schemas'

export type FixtureVersion = 'v41' | 'v42' | 'v43'
export type FixturePerson = 'P1' | 'P2' | 'P3'

export const P1 = 'TrE2eTei001'
export const P2 = 'TrE2eTei002'
export const PRG_OPEN = 'TrE2ePrg001'
export const PRG_ONCE = 'TrE2ePrg002'
export const PRG_PROTECTED = 'TrE2ePrg003'

export interface Fixtures {
    persons: Record<FixturePerson, PersonResponse>
    programs: ProgramsResponse
    trackedEntityType: TrackedEntityTypeResponse
    relationships: RelationshipsResponse
    relationshipTypes: RelationshipTypesResponse
    userScopes: UserScopesResponse
    orgUnitPaths: OrgUnitPathsResponse
}

const read = <T>(version: FixtureVersion, file: string, schema: ZodType<T>) =>
    schema.parse(
        JSON.parse(
            readFileSync(
                new URL(`./fixtures/${version}/${file}`, import.meta.url),
                'utf8'
            )
        )
    )

/** Parses one version's recorded fixtures, as the block's client would. */
export const loadFixtures = (version: FixtureVersion): Fixtures => ({
    persons: {
        P1: read(version, 'person-P1.json', PersonResponseSchema),
        P2: read(version, 'person-P2.json', PersonResponseSchema),
        P3: read(version, 'person-P3.json', PersonResponseSchema),
    },
    programs: read(version, 'programs.json', ProgramsResponseSchema),
    trackedEntityType: read(
        version,
        'tracked-entity-type.json',
        TrackedEntityTypeResponseSchema
    ),
    relationships: read(
        version,
        'relationships-P1.json',
        RelationshipsResponseSchema
    ),
    relationshipTypes: read(
        version,
        'relationship-types.json',
        RelationshipTypesResponseSchema
    ),
    userScopes: read(version, 'user-scopes.json', UserScopesResponseSchema),
    orgUnitPaths: read(
        version,
        'org-unit-paths.json',
        OrgUnitPathsResponseSchema
    ),
})

/**
 * Everything the builder gets for one person once every request answered,
 * scope lookups included (the provider makes those only when needed).
 */
export const sourcesFor = (
    fixtures: Fixtures,
    person: FixturePerson
): RecordSources => {
    const response = fixtures.persons[person]
    return {
        person: response,
        programs: fixtures.programs,
        trackedEntityType: fixtures.trackedEntityType,
        scopes: toUserScopes(fixtures.userScopes),
        ownerPaths: toOwnerPaths(fixtures.orgUnitPaths),
        relationships: {
            status: 'ready',
            relationships:
                person === 'P1'
                    ? buildRelationships(
                          response.trackedEntity,
                          fixtures.relationships,
                          fixtures.relationshipTypes
                      )
                    : [],
        },
    }
}

type ProgramMetadata = ProgramsResponse['programs'][number]

/** The programs response with one program's metadata changed. */
export const withProgram = (
    programs: ProgramsResponse,
    programId: string,
    edit: (program: ProgramMetadata) => ProgramMetadata
): ProgramsResponse => ({
    ...programs,
    programs: programs.programs.map((program) =>
        program.id === programId ? edit(program) : program
    ),
})
