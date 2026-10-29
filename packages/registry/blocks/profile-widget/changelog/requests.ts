import type { ProfileWidgetClient, QueryParameters } from '../api/client'
import { ChangelogResponseSchema } from '../api/schemas'
import type { ProfileServerFeatures } from '../api/serverVersion'
import type { TrackedEntityChangelogOrder } from '../types'

export interface ChangelogRequest {
    trackedEntityId: string
    programId: string | null
    page: number
    pageSize: number
    attributeId: string | null
    order: TrackedEntityChangelogOrder | null
}

export interface ChangelogRequestInput {
    trackedEntityId: string
    programId?: string
    page: number
    pageSize: number
    attributeId?: string
    order?: TrackedEntityChangelogOrder
}

const isOrderSupported = (
    order: TrackedEntityChangelogOrder,
    features: ProfileServerFeatures
) => order.column === 'createdAt' || features.changelogFilterAndOrder

export const resolveChangelogRequest = (
    input: ChangelogRequestInput,
    features: ProfileServerFeatures
): ChangelogRequest => ({
    trackedEntityId: input.trackedEntityId,
    programId: input.programId || null,
    page: Math.max(1, Math.trunc(input.page)),
    pageSize: Math.max(1, Math.trunc(input.pageSize)),
    attributeId:
        features.changelogFilterAndOrder && input.attributeId
            ? input.attributeId
            : null,
    order:
        input.order && isOrderSupported(input.order, features)
            ? input.order
            : null,
})

const changelogQueryParameters = (
    request: ChangelogRequest
): QueryParameters => ({
    page: request.page,
    pageSize: request.pageSize,
    program: request.programId ?? undefined,
    filter: request.attributeId
        ? `attribute:eq:${request.attributeId}`
        : undefined,
    order: request.order
        ? `${request.order.column}:${request.order.direction}`
        : undefined,
})

const changelogResource = (trackedEntityId: string) =>
    `tracker/trackedEntities/${trackedEntityId}/changeLogs`

export const fetchTrackedEntityChangelog = (
    client: ProfileWidgetClient,
    request: ChangelogRequest,
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: changelogResource(request.trackedEntityId),
            params: changelogQueryParameters(request),
        },
        ChangelogResponseSchema,
        signal
    )
