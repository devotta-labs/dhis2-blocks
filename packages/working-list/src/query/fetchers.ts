import { queryOptions } from '@tanstack/react-query'
import type { WorkingListCapabilities } from '../api/capabilities'
import {
    asWorkingListBoundaryError,
    shouldRetryWorkingListRequest,
    type WorkingListClient,
} from '../api/client'
import {
    EventsResponseSchema,
    TrackedEntitiesResponseSchema,
    normalizeEventsResponse,
    normalizeTrackedEntitiesResponse,
} from '../api/schemas'
import type {
    WorkingListConfiguration,
    WorkingListContext,
    WorkingListPagination,
    FieldCatalog,
} from '../domain/model'
import type { FilterSerializationContext } from '../registry/valueTypes'
import { workingListQueryKeys } from './keys'
import {
    normalizeEventValues,
    normalizeTrackedEntityValues,
    type NormalizedEvent,
    type NormalizedTrackedEntity,
    type RowIssueTranslate,
    type WorkingListRowIssue,
} from './normalizeRows'
import { planTrackedEntityJoin, serializeWorkingListRequest } from './serialize'

export interface TrackedEntityWorkingListPage {
    mode: 'trackedEntity'
    records: NormalizedTrackedEntity[]
    page: number
    pageSize: number
    hasNextPage: boolean
}

export interface EventWorkingListRow {
    event: NormalizedEvent
    trackedEntity?: NormalizedTrackedEntity
}

export interface EventWorkingListPage {
    mode: 'event'
    records: EventWorkingListRow[]
    page: number
    pageSize: number
    hasNextPage: boolean
}

export type WorkingListPage =
    | TrackedEntityWorkingListPage
    | EventWorkingListPage

export interface FetchWorkingListPageInput {
    client: WorkingListClient
    context: WorkingListContext
    configuration: WorkingListConfiguration
    pagination: WorkingListPagination
    capabilities: WorkingListCapabilities
    fields: FieldCatalog
    serializationContext?: FilterSerializationContext
    /** Localizes data-quality issue messages. Defaults to DHIS2 i18n. */
    translate?: RowIssueTranslate
    today?: string
    signal?: AbortSignal
}

const getHasNextPage = (
    recordCount: number,
    pagination: WorkingListPagination,
    pager?: {
        total?: number
        nextPage?: string
    }
) => {
    if (pager?.nextPage) {
        return true
    }
    if (pager?.total !== undefined) {
        return pagination.page * pagination.pageSize < pager.total
    }
    return recordCount >= pagination.pageSize
}

const reportDataQualityIssues = (
    page: number,
    issuesByRow: ReadonlyArray<{
        rowId: string
        issues: ReadonlyArray<WorkingListRowIssue>
    }>
) => {
    const details = issuesByRow.flatMap(({ rowId, issues }) =>
        issues.map((issue) => ({
            row: rowId,
            field: issue.fieldId,
            message: issue.message,
            raw: issue.raw,
        }))
    )
    if (details.length) {
        console.warn(
            `[working-list] ${details.length} invalid data value(s) on page ${page}`,
            details
        )
    }
}

export const fetchWorkingListPage = async ({
    client,
    signal,
    ...input
}: FetchWorkingListPageInput): Promise<WorkingListPage> => {
    const request = serializeWorkingListRequest(input)
    const { configuration } = input
    if (configuration.mode === 'trackedEntity') {
        const rawResponse = await client.query(
            request,
            TrackedEntitiesResponseSchema,
            signal
        )
        const response = normalizeTrackedEntitiesResponse(rawResponse)
        let records: NormalizedTrackedEntity[]
        try {
            records = response.trackedEntities.map((trackedEntity) =>
                normalizeTrackedEntityValues(trackedEntity, input.fields, {
                    programId: input.context.programId,
                    translate: input.translate,
                })
            )
        } catch (error) {
            throw asWorkingListBoundaryError(
                error,
                'Malformed tracked-entity response'
            )
        }
        reportDataQualityIssues(
            input.pagination.page,
            records.map((record) => ({
                rowId: record.trackedEntity.trackedEntity,
                issues: record.issues,
            }))
        )
        return {
            mode: 'trackedEntity',
            records,
            page: input.pagination.page,
            pageSize: input.pagination.pageSize,
            hasNextPage: getHasNextPage(
                records.length,
                input.pagination,
                response.pager
            ),
        }
    }

    const rawEventsResponse = await client.query(
        request,
        EventsResponseSchema,
        signal
    )
    const eventsResponse = normalizeEventsResponse(rawEventsResponse)
    let events: NormalizedEvent[]
    try {
        events = eventsResponse.events.map((event) =>
            normalizeEventValues(event, input.fields, {
                programStageId: configuration.programStageId,
                translate: input.translate,
            })
        )
    } catch (error) {
        throw asWorkingListBoundaryError(error, 'Malformed event response')
    }
    const joinPlan = planTrackedEntityJoin({
        events: events.map((record) => record.event),
        programId: configuration.programId,
        pageSize: input.pagination.pageSize,
    })
    let trackedEntitiesById = new Map<string, NormalizedTrackedEntity>()
    if (joinPlan) {
        const rawJoinResponse = await client.query(
            joinPlan.request,
            TrackedEntitiesResponseSchema,
            signal
        )
        const joinResponse = normalizeTrackedEntitiesResponse(rawJoinResponse)
        try {
            trackedEntitiesById = new Map(
                joinResponse.trackedEntities.map((trackedEntity) => {
                    const normalized = normalizeTrackedEntityValues(
                        trackedEntity,
                        input.fields,
                        {
                            programId: input.context.programId,
                            translate: input.translate,
                        }
                    )
                    return [normalized.trackedEntity.trackedEntity, normalized]
                })
            )
        } catch (error) {
            throw asWorkingListBoundaryError(
                error,
                'Malformed tracked-entity join response'
            )
        }
        const missingIds = joinPlan.trackedEntityIds.filter(
            (id) => !trackedEntitiesById.has(id)
        )
        if (missingIds.length) {
            throw asWorkingListBoundaryError(
                new Error(`Omitted IDs: ${missingIds.join(', ')}`),
                'Malformed tracked-entity join response'
            )
        }
    }
    const records = events.map((event) => ({
        event,
        trackedEntity: event.event.trackedEntity
            ? trackedEntitiesById.get(event.event.trackedEntity)
            : undefined,
    }))
    reportDataQualityIssues(
        input.pagination.page,
        records.map((record) => ({
            rowId: record.event.event.event,
            issues: [
                ...(record.trackedEntity?.issues ?? []),
                ...record.event.issues,
            ],
        }))
    )
    return {
        mode: 'event',
        records,
        page: input.pagination.page,
        pageSize: input.pagination.pageSize,
        hasNextPage: getHasNextPage(
            events.length,
            input.pagination,
            eventsResponse.pager
        ),
    }
}

export const shouldRetryWorkingListQuery = shouldRetryWorkingListRequest

export const workingListPageQueryOptions = (
    input: Omit<FetchWorkingListPageInput, 'signal'>
) => {
    const request = serializeWorkingListRequest(input)
    return queryOptions({
        queryKey: workingListQueryKeys.recordRequest(request),
        queryFn: ({ signal }) => fetchWorkingListPage({ ...input, signal }),
        staleTime: 20_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryWorkingListRequest,
        placeholderData: (previous) => previous,
    })
}
