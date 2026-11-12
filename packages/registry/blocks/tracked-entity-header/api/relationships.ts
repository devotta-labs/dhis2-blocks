import { useDataEngine } from '@dhis2/app-runtime'
import { skipToken, useQuery } from '@tanstack/react-query'
import {
    METADATA_STALE_TIME,
    shouldRetryRequest,
    type DataEngine,
} from './queries'
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
const fetchRelationships = async (
    engine: DataEngine,
    trackedEntity: string,
    signal: AbortSignal
): Promise<RelationshipRecord[]> => {
    const { relationships } = await engine.query(
        {
            relationships: {
                resource: 'tracker/relationships',
                params: {
                    trackedEntity,
                    paging: false,
                    fields: RELATIONSHIP_FIELDS,
                },
            },
        },
        { signal }
    )
    return RelationshipsResponseSchema.parse(relationships).flatMap((r) => {
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
}

const fetchRelationshipTypes = async (
    engine: DataEngine,
    ids: string[],
    signal: AbortSignal
): Promise<Map<string, RelationshipTypeMeta>> => {
    const { types } = await engine.query(
        {
            types: {
                resource: 'relationshipTypes',
                params: {
                    filter: idsFilter(ids),
                    paging: false,
                    fields: TYPE_FIELDS,
                },
            },
        },
        { signal }
    )
    return RelationshipTypesResponseSchema.parse(types)
}

/** Labels and value types of the attributes a relationship type's data view shows. */
const fetchViewAttributes = async (
    engine: DataEngine,
    ids: string[],
    signal: AbortSignal
): Promise<Map<string, AttributeMeta>> => {
    const { attributes } = await engine.query(
        {
            attributes: {
                resource: 'trackedEntityAttributes',
                params: {
                    filter: idsFilter(ids),
                    paging: false,
                    fields: ATTRIBUTE_FIELDS,
                },
            },
        },
        { signal }
    )
    return ViewAttributesResponseSchema.parse(attributes)
}

/** The same ids in any order are one request. */
const idsKey = (ids: string[]) => [...ids].sort().join(',')

/** A tracked entity's relationships, asked for fresh every time. Waits while there is no tracked entity. */
export const useRelationshipLinks = (trackedEntity: string | undefined) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: [
            'tracked-entity-header',
            'relationships',
            trackedEntity ?? null,
        ],
        queryFn:
            trackedEntity === undefined
                ? skipToken
                : ({ signal }) =>
                      fetchRelationships(engine, trackedEntity, signal),
        retry: shouldRetryRequest,
    })
}

/** Nothing is asked for without an id. */
export const useRelationshipTypes = (ids: string[]) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['tracked-entity-header', 'relationshipTypes', idsKey(ids)],
        queryFn: ({ signal }) => fetchRelationshipTypes(engine, ids, signal),
        enabled: ids.length > 0,
        retry: shouldRetryRequest,
        staleTime: METADATA_STALE_TIME,
    })
}

/** Nothing is asked for without an id. */
export const useViewAttributes = (ids: string[]) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: ['tracked-entity-header', 'viewAttributes', idsKey(ids)],
        queryFn: ({ signal }) => fetchViewAttributes(engine, ids, signal),
        enabled: ids.length > 0,
        retry: shouldRetryRequest,
        staleTime: METADATA_STALE_TIME,
    })
}
