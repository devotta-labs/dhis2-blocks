import { ZodError, type ZodType } from 'zod'
import type { RelationshipMetadata } from '../domain/labels'
import type { NodeKind, NodeRecord, NodeRef } from '../domain/model'
import {
    RelationshipViewerBoundaryError,
    type DataEngineQueryParameters,
    type RelationshipViewerClient,
} from './client'
import {
    EnrollmentRecordSchema,
    EventRecordSchema,
    MetadataSchema,
    SeedPageSchema,
    TrackedEntityRecordSchema,
} from './schemas'

const ITEM = 'trackedEntity[trackedEntity],enrollment[enrollment],event[event]'
export const RELATIONSHIP_FIELDS = `relationships[relationship,relationshipType,bidirectional,createdAt,from[${ITEM}],to[${ITEM}]]`
export const TRACKED_ENTITY_FIELDS = `trackedEntity,trackedEntityType,attributes[attribute,displayName,value],enrollments[enrollment,program,status,followUp,enrolledAt,occurredAt],${RELATIONSHIP_FIELDS}`
export const ENROLLMENT_FIELDS = `enrollment,trackedEntity,program,status,followUp,enrolledAt,occurredAt,attributes[attribute,displayName,value],${RELATIONSHIP_FIELDS}`
export const EVENT_FIELDS = `event,program,programStage,status,occurredAt,dataValues[dataElement,value],${RELATIONSHIP_FIELDS}`

const SEED_PAGE_SIZE = 50
const RELATIONSHIP_TYPE_FIELDS =
    'id,displayName,bidirectional,fromToName,toFromName,fromConstraint[relationshipEntity,trackerDataView[attributes,dataElements]],toConstraint[relationshipEntity,trackerDataView[attributes,dataElements]]'
const TRACKED_ENTITY_TYPE_FIELDS =
    'id,trackedEntityTypeAttributes[displayInList,trackedEntityAttribute[id]]'

export type SeedQuery = DataEngineQueryParameters & { program: string }

const NODE_RESOURCES = {
    trackedEntity: {
        resource: 'tracker/trackedEntities',
        fields: TRACKED_ENTITY_FIELDS,
        schema: TrackedEntityRecordSchema,
    },
    enrollment: {
        resource: 'tracker/enrollments',
        fields: ENROLLMENT_FIELDS,
        schema: EnrollmentRecordSchema,
    },
    event: {
        resource: 'tracker/events',
        fields: EVENT_FIELDS,
        schema: EventRecordSchema,
    },
} satisfies Record<
    NodeKind,
    { resource: string; fields: string; schema: ZodType<NodeRecord> }
>

// Only schema violations become boundary errors; operational failures keep their status for retry.
const asBoundary = async <T>(request: Promise<T>, context: string) => {
    try {
        return await request
    } catch (cause) {
        if (cause instanceof ZodError) {
            throw new RelationshipViewerBoundaryError(
                `${context}: ${cause.message}`,
                cause
            )
        }
        throw cause
    }
}

export function fetchNodeRecord(
    client: RelationshipViewerClient,
    ref: NodeRef,
    program: string | undefined,
    signal?: AbortSignal
): Promise<NodeRecord> {
    const { resource, fields, schema } = NODE_RESOURCES[ref.kind]
    const params: DataEngineQueryParameters =
        ref.kind === 'trackedEntity' && program
            ? { program, fields }
            : { fields }
    return asBoundary(
        client.query({ resource, id: ref.id, params }, schema, signal),
        `Malformed ${ref.kind} ${ref.id}`
    )
}

export async function fetchSeedPage(
    client: RelationshipViewerClient,
    query: SeedQuery,
    page: number,
    signal?: AbortSignal
): Promise<{ records: NodeRecord[]; hasMore: boolean }> {
    const { trackedEntities } = await asBoundary(
        client.query(
            {
                resource: 'tracker/trackedEntities',
                params: {
                    ...query,
                    page,
                    pageSize: SEED_PAGE_SIZE,
                    fields: TRACKED_ENTITY_FIELDS,
                },
            },
            SeedPageSchema,
            signal
        ),
        `Malformed seed page ${page}`
    )
    return {
        records: trackedEntities,
        hasMore: trackedEntities.length === SEED_PAGE_SIZE,
    }
}

export function fetchRelationshipMetadata(
    client: RelationshipViewerClient,
    signal?: AbortSignal
): Promise<RelationshipMetadata> {
    return asBoundary(
        client.queryAll(
            {
                relationshipTypes: {
                    resource: 'relationshipTypes',
                    params: { paging: false, fields: RELATIONSHIP_TYPE_FIELDS },
                },
                trackedEntityTypes: {
                    resource: 'trackedEntityTypes',
                    params: {
                        paging: false,
                        fields: TRACKED_ENTITY_TYPE_FIELDS,
                    },
                },
            },
            MetadataSchema,
            signal
        ),
        'Malformed relationship metadata'
    )
}
