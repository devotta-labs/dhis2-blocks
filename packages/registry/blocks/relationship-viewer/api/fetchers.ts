import { ZodError, type ZodType } from 'zod'
import type { RelationshipMetadata } from '../domain/labels'
import type { NodeKind, NodeRecord, NodeRef } from '../domain/model'
import {
    getErrorStatus,
    RelationshipViewerBoundaryError,
    type DataEngineQueryParameters,
    type RelationshipViewerClient,
} from './client'
import {
    EnrollmentRecordSchema,
    EventRecordSchema,
    MetadataSchema,
    RelationshipListSchema,
    SeedPageSchema,
    TrackedEntityRecordSchema,
} from './schemas'

const ITEM = 'trackedEntity[trackedEntity],enrollment[enrollment],event[event]'
export const RELATIONSHIP_FIELDS = `relationship,relationshipType,bidirectional,createdAt,from[${ITEM}],to[${ITEM}]`
export const TRACKED_ENTITY_FIELDS =
    'trackedEntity,trackedEntityType,attributes[attribute,displayName,value],enrollments[enrollment,program,status,followUp,enrolledAt,occurredAt]'
export const ENROLLMENT_FIELDS =
    'enrollment,trackedEntity,program,status,followUp,enrolledAt,occurredAt,attributes[attribute,displayName,value]'
export const EVENT_FIELDS =
    'event,program,programStage,status,occurredAt,dataValues[dataElement,value]'

const SEED_PAGE_SIZE = 50
// What DHIS2 answers a tracked entity read with a `program` it is not enrolled in.
const NOT_IN_PROGRAM = new Set([403, 404, 409])
export const RELATIONSHIP_TYPE_FIELDS =
    'id,displayName,bidirectional,fromToName,toFromName,fromConstraint[relationshipEntity,trackerDataView[attributes,dataElements]],toConstraint[relationshipEntity,trackerDataView[attributes,dataElements]]'
export const TRACKED_ENTITY_TYPE_FIELDS =
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
    {
        resource: string
        fields: string
        schema: ZodType<
            Omit<NodeRecord, 'relationships' | 'unresolvedLinkCount'>
        >
    }
>

// Only schema violations become boundary errors; operational failures keep their status for retry.
// The Zod issues stay in `cause`; the message names what was malformed.
const asBoundary = async <T>(request: Promise<T>, what: string) => {
    try {
        return await request
    } catch (cause) {
        if (cause instanceof ZodError) {
            throw new RelationshipViewerBoundaryError(
                `DHIS2 returned a malformed ${what}.`,
                cause
            )
        }
        throw cause
    }
}

/**
 * One record and its relationships, in parallel. Record endpoints embed one-way
 * relationships only on their `from` side; tracker/relationships returns both sides.
 */
export async function fetchNodeRecord(
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
    const readRecord = async () => {
        try {
            return await client.query(
                { resource, id: ref.id, params },
                schema,
                signal
            )
        } catch (cause) {
            // DHIS2 refuses `program` for a tracked entity not enrolled in it; read it without.
            if (
                params.program !== undefined &&
                NOT_IN_PROGRAM.has(getErrorStatus(cause) ?? 0)
            ) {
                return client.query(
                    { resource, id: ref.id, params: { fields } },
                    schema,
                    signal
                )
            }
            throw cause
        }
    }
    const [record, { relationships, unresolvedLinkCount }] = await asBoundary(
        Promise.all([
            readRecord(),
            client.query(
                {
                    resource: 'tracker/relationships',
                    params: {
                        [ref.kind]: ref.id,
                        paging: false,
                        fields: RELATIONSHIP_FIELDS,
                    },
                },
                RelationshipListSchema,
                signal
            ),
        ]),
        `${ref.kind} ${ref.id}`
    )
    return {
        ...record,
        relationships,
        ...(unresolvedLinkCount > 0 && { unresolvedLinkCount }),
    }
}

export async function fetchSeedPage(
    client: RelationshipViewerClient,
    query: SeedQuery,
    page: number,
    signal?: AbortSignal
): Promise<{ refs: NodeRef[]; hasMore: boolean }> {
    const { trackedEntities } = await asBoundary(
        client.query(
            {
                resource: 'tracker/trackedEntities',
                params: {
                    ...query,
                    page,
                    pageSize: SEED_PAGE_SIZE,
                    fields: 'trackedEntity',
                },
            },
            SeedPageSchema,
            signal
        ),
        `seed page ${page}`
    )
    return {
        refs: trackedEntities,
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
        'relationship metadata'
    )
}
