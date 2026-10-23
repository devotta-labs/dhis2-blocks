import {
    attributeValues,
    programIdsToLoad,
    resolveProgramState,
    sortedByKey,
    toAttributeInfo,
    type RecordSources,
} from './programState'
import type {
    PersonResponse,
    RelationshipsResponse,
    RelationshipTypesResponse,
} from './schemas'
import type {
    ProgramRecord,
    Relationship,
    TrackedEntityRecord,
    TrackedEntityTypeInfo,
} from './types'

// API responses → TrackedEntityRecord (spec 8). Pure: the provider calls it
// once every request it needs has answered.

type RelationshipResponse = RelationshipsResponse['relationships'][number]
type RelationshipSide = RelationshipResponse['from']

const toTrackedEntityType = ({
    trackedEntityType,
}: RecordSources): TrackedEntityTypeInfo => ({
    id: trackedEntityType.id,
    name: trackedEntityType.displayName,
    access: {
        read: trackedEntityType.access.data.read,
        write: trackedEntityType.access.data.write,
    },
    attributes:
        trackedEntityType.trackedEntityTypeAttributes.map(toAttributeInfo),
})

/**
 * Spec 15 finding 3: top-level attributes are the type's; program attributes
 * come only on enrollments. So the person's values are both, merged.
 */
const personAttributes = (person: PersonResponse) =>
    sortedByKey(
        attributeValues([
            ...person.attributes,
            ...person.enrollments.flatMap(({ attributes }) => attributes),
        ])
    )

/**
 * Spec 7.2: the requested programs, in that order; else every program with a
 * visible enrollment or an owner row whose metadata came back, by name.
 */
const programIds = (sources: RecordSources): string[] => {
    if (sources.requestedPrograms) {
        return [...new Set(sources.requestedPrograms)]
    }
    const ids = programIdsToLoad(sources.person)
    // A failed programs request returned no names; every program shows the error.
    if (sources.programsError) return ids
    const names = new Map(
        sources.programs.programs.map(({ id, displayName }) => [
            id,
            displayName,
        ])
    )
    return ids
        .flatMap((id) => {
            const name = names.get(id)
            return name === undefined ? [] : [{ id, name }]
        })
        .sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : 1))
        .map(({ id }) => id)
}

const programStates = (sources: RecordSources) =>
    new Map<string, ProgramRecord>(
        programIds(sources).map((id) => [id, resolveProgramState(id, sources)])
    )

export const buildRecord = (sources: RecordSources): TrackedEntityRecord => {
    const { person } = sources
    return {
        person: {
            id: person.trackedEntity,
            trackedEntityType: toTrackedEntityType(sources),
            orgUnit: person.orgUnit,
            inactive: person.inactive,
            potentialDuplicate: person.potentialDuplicate,
            createdAt: person.createdAt,
            updatedAt: person.updatedAt,
            attributes: personAttributes(person),
        },
        programs: programStates(sources),
        relationships: sources.relationships,
    }
}

const toOther = (side: RelationshipSide): Relationship['other'] => ({
    trackedEntity: side.trackedEntity?.trackedEntity,
    enrollment: side.enrollment?.enrollment,
    event: side.event?.event,
    attributes:
        side.trackedEntity &&
        sortedByKey(attributeValues(side.trackedEntity.attributes)),
})

/**
 * Spec 8.3: each relationship from this person's side. A type the user can't
 * read (not in `types`) is named by its id.
 */
export const buildRelationships = (
    personId: string,
    relationships: RelationshipsResponse,
    types: RelationshipTypesResponse
): Relationship[] => {
    const typesById = new Map(
        types.relationshipTypes.map((type) => [type.id, type])
    )
    return relationships.relationships.map((relationship) => {
        const typeId = relationship.relationshipType
        const type = typesById.get(typeId)
        const direction =
            relationship.from.trackedEntity?.trackedEntity === personId
                ? 'from'
                : 'to'
        return {
            id: relationship.relationship,
            type: {
                id: typeId,
                name: type?.displayName ?? typeId,
                fromToName: type?.fromToName ?? typeId,
                toFromName: type?.toFromName,
                bidirectional: type?.bidirectional ?? false,
            },
            direction,
            other: toOther(
                direction === 'from' ? relationship.to : relationship.from
            ),
            createdAt: relationship.createdAt ?? '',
        }
    })
}
