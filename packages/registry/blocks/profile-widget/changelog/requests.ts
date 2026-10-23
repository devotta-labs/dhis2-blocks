import type { ProfileWidgetClient, QueryParameters } from '../api/client'
import { ChangelogResponseSchema } from '../api/schemas'
import type { ProfileServerFeatures } from '../api/serverVersion'
import type { TrackedEntityChangelogOrder } from '../types'

/*
 * `GET tracker/trackedEntities/{id}/changeLogs` on DHIS2 2.41–2.43.
 *
 * - `page` (1-based) and `pageSize`; the pager never carries a total, only a
 *   `nextPage` link (the server reads one extra row to know).
 * - `program` scopes the call to that program's attributes.
 * - `order=createdAt|username|attribute:asc|desc`. 2.41 orders by `createdAt`
 *   only; `username` and `attribute` are 2.42+.
 * - `filter=attribute:eq:{uid}` is 2.42+; 2.41 ignores unknown parameters.
 */

/** The changelog request after server-version gating. */
export interface ChangelogRequest {
    trackedEntityId: string
    programId: string | null
    page: number
    pageSize: number
    /** Only set when the server supports filtering (2.42+). */
    attributeId: string | null
    /** Only set when the server supports this column (createdAt always). */
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

/** Drops the filter and order columns the connected server cannot honour. */
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

/** Query parameters for a resolved request; app-runtime drops undefined ones. */
export const changelogQueryParameters = (
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

/** The resource path; the id is part of the path, not a separate `id`. */
const changelogResource = (trackedEntityId: string) =>
    `tracker/trackedEntities/${trackedEntityId}/changeLogs`

/** Throws the raw failure; callers map it with `toProfileWidgetLoadError`. */
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
