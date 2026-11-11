import type { Result } from 'better-result'
import type { TrackedEntityHeaderResourceClient } from './client'
import {
    RelationshipsResponseSchema,
    RelationshipTypesResponseSchema,
    ViewAttributesResponseSchema,
} from './relationshipSchemas'
import type {
    AttributeMeta,
    RelationshipEnd,
    RelationshipRecord,
    RelationshipTypeMeta,
} from './types'

const END =
    'trackedEntity[trackedEntity,trackedEntityType,attributes[attribute,value]],enrollment[enrollment],event[event]'

const RELATIONSHIP_FIELDS = `relationship,relationshipType,relationshipName,bidirectional,from[${END}],to[${END}]`

const CONSTRAINT =
    'relationshipEntity,trackedEntityType[id,displayName],trackerDataView[attributes]'

const TYPE_FIELDS = `id,displayName,fromToName,toFromName,bidirectional,fromConstraint[${CONSTRAINT}],toConstraint[${CONSTRAINT}]`

const ATTRIBUTE_FIELDS =
    'id,displayFormName,valueType,optionSet[options[code,displayName]]'

const idsFilter = (ids: string[]) => `id:in:[${ids.join(',')}]`

const endOf = (
    { from, to }: { from: { entityId?: string }; to: { entityId?: string } },
    id: string
): RelationshipEnd | undefined => {
    if (from.entityId === id) {
        return 'from'
    }
    return to.entityId === id ? 'to' : undefined
}

/** Every relationship the tracked entity is an end of, with the end opposite it. */
export const fetchRelationships = async (
    client: TrackedEntityHeaderResourceClient,
    trackedEntity: string,
    signal?: AbortSignal
): Promise<Result<RelationshipRecord[], Error>> => {
    const result = await client.query(
        {
            resource: 'tracker/relationships',
            params: {
                trackedEntity,
                paging: false,
                fields: RELATIONSHIP_FIELDS,
            },
        },
        RelationshipsResponseSchema,
        signal
    )
    return result.map((relationships) =>
        relationships.flatMap((r) => {
            const end = endOf(r, trackedEntity)
            if (end === undefined) {
                return []
            }
            return [
                {
                    id: r.relationship,
                    type: r.relationshipType,
                    ...(r.relationshipName !== undefined && {
                        name: r.relationshipName,
                    }),
                    end,
                    // A self-link is one record: its other end is the entity itself.
                    other: (end === 'from' ? r.to : r.from).linked,
                },
            ]
        })
    )
}

export const fetchRelationshipTypes = (
    client: TrackedEntityHeaderResourceClient,
    ids: string[],
    signal?: AbortSignal
): Promise<Result<Map<string, RelationshipTypeMeta>, Error>> =>
    client.query(
        {
            resource: 'relationshipTypes',
            params: {
                filter: idsFilter(ids),
                paging: false,
                fields: TYPE_FIELDS,
            },
        },
        RelationshipTypesResponseSchema,
        signal
    )

/** Labels and value types of the attributes a relationship type's data view shows. */
export const fetchViewAttributes = (
    client: TrackedEntityHeaderResourceClient,
    ids: string[],
    signal?: AbortSignal
): Promise<Result<Map<string, AttributeMeta>, Error>> =>
    client.query(
        {
            resource: 'trackedEntityAttributes',
            params: {
                filter: idsFilter(ids),
                paging: false,
                fields: ATTRIBUTE_FIELDS,
            },
        },
        ViewAttributesResponseSchema,
        signal
    )
