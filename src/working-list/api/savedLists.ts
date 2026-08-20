import { queryOptions, mutationOptions } from '@tanstack/react-query'
import { z } from 'zod'
import type {
    AppliedFilter,
    FieldCatalog,
    FilterOperator,
    FilterValue,
    WorkingListConfiguration,
    WorkingListField,
    WorkingListSort,
} from '../domain/model'
import { WorkingListConfigurationSchema } from '../domain/schemas'
import {
    repairConfigurationReferences,
    StaleWorkingListError,
    validateConfigurationReferences,
    type StaleReferenceRepairDecision,
    type StaleReferenceIssue,
} from '../domain/staleReferences'
import { workingListQueryKeys } from '../query/keys'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import { validateSystemFilter } from '../registry/systemFilters'
import {
    getValueTypeDefinition,
    validateAppliedFilter,
} from '../registry/valueTypes'
import type {
    FilterParsingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
import type { WorkingListCapabilities } from './capabilities'
import {
    asWorkingListBoundaryError,
    shouldRetryWorkingListRequest,
    type WorkingListClient,
} from './client'
import type { ProgramFieldCatalog } from './metadata'
import {
    DeleteMutationResponseSchema,
    MutationResponseSchema,
    ProgramStageWorkingListsResponseSchema,
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
    TrackedEntityInstanceFiltersResponseSchema,
    type EntityQueryCriteria,
    type ProgramStageQueryCriteria,
    type ProgramStageWorkingList,
    type SavedValueFilter,
    type SharingAccessEntry,
    type TrackedEntityInstanceFilter,
} from './schemas'

export type SavedListResource =
    | 'trackedEntityInstanceFilters'
    | 'programStageWorkingLists'

export interface SavedListSharing {
    access?: Record<string, unknown>
    externalAccess?: boolean
    publicAccess?: string
    user?: Record<string, unknown>
    userAccesses?: SharingAccessEntry[]
    userGroupAccesses?: SharingAccessEntry[]
}

export interface SavedListBase {
    id: string
    name: string
    /** Stable key for generated labels; metadata names remain server-provided. */
    labelKey?: string
    resource: SavedListResource
    sortOrder?: number
    sharing: SavedListSharing
}

export type NormalizedSavedWorkingList =
    | (SavedListBase & {
          compatibility: 'compatible'
          configuration: WorkingListConfiguration
          /** Parsed server resource used to preserve writable extensions. */
          raw?: TrackedEntityInstanceFilter | ProgramStageWorkingList
      })
    | (SavedListBase & {
          compatibility: 'incompatible'
          issues: StaleReferenceIssue[]
          raw: TrackedEntityInstanceFilter | ProgramStageWorkingList
          /** Present when the raw resource could be parsed before validation. */
          candidateConfiguration?: WorkingListConfiguration
      })

const getSharing = (
    resource: TrackedEntityInstanceFilter | ProgramStageWorkingList
): SavedListSharing => ({
    access: resource.access,
    externalAccess: resource.externalAccess,
    publicAccess: resource.publicAccess,
    user: resource.user,
    userAccesses: resource.userAccesses,
    userGroupAccesses: resource.userGroupAccesses,
})

const findField = (fields: FieldCatalog, idOrApiName: string) =>
    fields.get(idOrApiName) ??
    [...fields.values()].find((field) => field.apiName === idOrApiName)

const getMissingIssue = (
    referenceId: string,
    path: string,
    kind: StaleReferenceIssue['kind'] = 'missingFilterField'
): StaleReferenceIssue => ({
    kind,
    referenceId,
    path,
    message: `Saved list references unavailable ${referenceId} at ${path}`,
})

const getSavedFilterOperator = (
    filter: SavedValueFilter,
    value: FilterValue
): FilterOperator => {
    if (value.kind === 'empty') {
        return value.isEmpty ? 'empty' : 'notEmpty'
    }
    if (
        value.kind === 'dateRange' ||
        value.kind === 'numberRange' ||
        value.kind === 'timeRange'
    ) {
        return 'range'
    }
    if (value.kind === 'options' || value.kind === 'boolean') {
        return 'in'
    }
    if (filter.like != null) {
        return 'like'
    }
    if (filter.sw != null) {
        return 'startsWith'
    }
    if (filter.ew != null) {
        return 'endsWith'
    }
    return 'equals'
}

const normalizeValueFilter = (
    filter: SavedValueFilter,
    field: WorkingListField,
    parsingContext?: FilterParsingContext
): AppliedFilter => {
    const value = getValueTypeDefinition(field.valueType).parseSaved(
        filter,
        parsingContext
    )
    return {
        field,
        value,
        operator: getSavedFilterOperator(filter, value),
    }
}

const normalizeDateValue = (
    value:
        | EntityQueryCriteria['enrollmentCreatedDate']
        | ProgramStageQueryCriteria['eventOccurredAt'],
    parsingContext?: FilterParsingContext
): FilterValue => {
    if (!value) {
        throw new Error('Cannot normalize an absent date filter')
    }
    return value.type === 'ABSOLUTE'
        ? {
              kind: 'dateRange',
              mode: 'absolute',
              start: value.startDate
                  ? (parsingContext?.fromApiDate?.(value.startDate) ??
                    value.startDate)
                  : undefined,
              end: value.endDate
                  ? (parsingContext?.fromApiDate?.(value.endDate) ??
                    value.endDate)
                  : undefined,
          }
        : {
              kind: 'dateRange',
              mode: 'relative',
              period: value.period ?? undefined,
              startBuffer: value.startBuffer ?? undefined,
              endBuffer: value.endBuffer ?? undefined,
          }
}

const systemFilter = (
    fields: FieldCatalog,
    {
        id,
        operator,
        value,
    }: {
        id: string
        operator: FilterOperator
        value: FilterValue
    }
) => {
    const field = fields.get(id)
    if (!field) {
        throw new StaleWorkingListError([getMissingIssue(id, id)])
    }
    return validateSystemFilter({ field, operator, value })
}

const normalizeCommonCriteria = (
    criteria: EntityQueryCriteria | ProgramStageQueryCriteria,
    fields: FieldCatalog,
    parsingContext?: FilterParsingContext
) => {
    const filters: AppliedFilter[] = []
    if (criteria.enrollmentStatus) {
        filters.push(
            systemFilter(fields, {
                id: 'enrollmentStatus',
                operator: 'in',
                value: {
                    kind: 'options',
                    values: [criteria.enrollmentStatus],
                },
            })
        )
    }
    if (criteria.followUp != null) {
        filters.push(
            systemFilter(fields, {
                id: 'followUp',
                operator: 'equals',
                value: {
                    kind: 'boolean',
                    values: [
                        criteria.followUp === true ||
                            criteria.followUp === 'true',
                    ],
                },
            })
        )
    }
    if (criteria.assignedUserMode) {
        filters.push(
            systemFilter(fields, {
                id: 'assignedUser',
                operator: 'equals',
                value: {
                    kind: 'assignee',
                    mode: criteria.assignedUserMode,
                    userIds: criteria.assignedUsers ?? undefined,
                },
            })
        )
    }
    for (const [index, savedFilter] of (
        criteria.attributeValueFilters ?? []
    ).entries()) {
        if (!savedFilter.attribute) {
            throw new Error(
                `attributeValueFilters.${index} is missing attribute`
            )
        }
        const field = fields.get(savedFilter.attribute)
        if (!field) {
            throw new StaleWorkingListError([
                getMissingIssue(
                    savedFilter.attribute,
                    `attributeValueFilters.${index}.attribute`
                ),
            ])
        }
        if (!field.filterable) {
            throw new StaleWorkingListError([
                getMissingIssue(
                    savedFilter.attribute,
                    `attributeValueFilters.${index}.attribute`,
                    'unsupportedFilter'
                ),
            ])
        }
        filters.push(normalizeValueFilter(savedFilter, field, parsingContext))
    }
    return filters
}

const normalizeColumns = (
    displayColumnOrder: string[] | null | undefined,
    defaults: string[],
    fields: FieldCatalog
) =>
    (displayColumnOrder ?? defaults).map((id, index) => {
        const field = findField(fields, id)
        if (!field) {
            throw new StaleWorkingListError([
                getMissingIssue(
                    id,
                    `displayColumnOrder.${index}`,
                    'missingColumn'
                ),
            ])
        }
        return field.id
    })

const normalizeSort = (
    order: string | null | undefined,
    fields: FieldCatalog
): WorkingListSort => {
    if (!order) {
        return { ...DEFAULT_WORKING_LIST_SORT }
    }
    const separator = order.lastIndexOf(':')
    const rawId = separator >= 0 ? order.slice(0, separator) : order
    const direction = separator >= 0 ? order.slice(separator + 1) : 'asc'
    if (direction !== 'asc' && direction !== 'desc') {
        throw new Error(`Invalid saved sort direction: ${direction}`)
    }
    const field = findField(fields, rawId)
    if (!field) {
        throw new StaleWorkingListError([
            getMissingIssue(rawId, 'order', 'missingSortField'),
        ])
    }
    return { fieldId: field.id, direction }
}

const normalizeTrackedEntityResource = ({
    resource,
    programId,
    metadata,
    parsingContext,
}: {
    resource: TrackedEntityInstanceFilter
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
}): WorkingListConfiguration => {
    const criteria = resource.entityQueryCriteria ?? {}
    const filters = normalizeCommonCriteria(
        criteria,
        metadata.fields,
        parsingContext
    )
    if (criteria.enrollmentCreatedDate) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'enrolledAt',
                operator: 'range',
                value: normalizeDateValue(
                    criteria.enrollmentCreatedDate,
                    parsingContext
                ),
            })
        )
    }
    if (criteria.enrollmentIncidentDate) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'enrollmentOccurredAt',
                operator: 'range',
                value: normalizeDateValue(
                    criteria.enrollmentIncidentDate,
                    parsingContext
                ),
            })
        )
    }
    return {
        mode: 'trackedEntity',
        programId,
        filters,
        columns: normalizeColumns(
            criteria.displayColumnOrder,
            metadata.defaultTrackedEntityColumns,
            metadata.fields
        ),
        sort: normalizeSort(criteria.order, metadata.fields),
    }
}

const normalizeEventResource = ({
    resource,
    programId,
    metadata,
    parsingContext,
}: {
    resource: ProgramStageWorkingList
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
}): WorkingListConfiguration => {
    const programStageId = resource.programStage.id
    if (!metadata.readableProgramStageIds.has(programStageId)) {
        throw new StaleWorkingListError([
            getMissingIssue(
                programStageId,
                'programStage.id',
                'missingProgramStage'
            ),
        ])
    }
    const criteria = resource.programStageQueryCriteria ?? {}
    const filters = normalizeCommonCriteria(
        criteria,
        metadata.fields,
        parsingContext
    )
    if (criteria.enrolledAt) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'enrolledAt',
                operator: 'range',
                value: normalizeDateValue(criteria.enrolledAt, parsingContext),
            })
        )
    }
    if (criteria.enrollmentOccurredAt) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'enrollmentOccurredAt',
                operator: 'range',
                value: normalizeDateValue(
                    criteria.enrollmentOccurredAt,
                    parsingContext
                ),
            })
        )
    }
    if (criteria.eventStatus) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'eventStatus',
                operator: 'in',
                value: {
                    kind: 'options',
                    values: [criteria.eventStatus],
                },
            })
        )
    }
    if (criteria.eventOccurredAt) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'eventOccurredAt',
                operator: 'range',
                value: normalizeDateValue(
                    criteria.eventOccurredAt,
                    parsingContext
                ),
            })
        )
    }
    if (criteria.eventScheduledAt) {
        filters.push(
            systemFilter(metadata.fields, {
                id: 'eventScheduledAt',
                operator: 'range',
                value: normalizeDateValue(
                    criteria.eventScheduledAt,
                    parsingContext
                ),
            })
        )
    }
    if (criteria.assignedUserMode) {
        const index = filters.findIndex(
            (filter) => filter.field.id === 'assignedUser'
        )
        if (index >= 0) {
            filters.splice(index, 1)
        }
        filters.push(
            systemFilter(metadata.fields, {
                id: 'eventAssignedUser',
                operator: 'equals',
                value: {
                    kind: 'assignee',
                    mode: criteria.assignedUserMode,
                    userIds: criteria.assignedUsers ?? undefined,
                },
            })
        )
    }
    for (const [index, savedFilter] of (criteria.dataFilters ?? []).entries()) {
        if (!savedFilter.dataItem) {
            throw new Error(`dataFilters.${index} is missing dataItem`)
        }
        const field = metadata.fields.get(savedFilter.dataItem)
        if (!field) {
            throw new StaleWorkingListError([
                getMissingIssue(
                    savedFilter.dataItem,
                    `dataFilters.${index}.dataItem`
                ),
            ])
        }
        if (!field.filterable) {
            throw new StaleWorkingListError([
                getMissingIssue(
                    savedFilter.dataItem,
                    `dataFilters.${index}.dataItem`,
                    'unsupportedFilter'
                ),
            ])
        }
        filters.push(normalizeValueFilter(savedFilter, field, parsingContext))
    }
    return {
        mode: 'event',
        programId,
        programStageId,
        filters,
        columns: normalizeColumns(
            criteria.displayColumnOrder,
            metadata.defaultEventColumnsByStage.get(programStageId) ?? [],
            metadata.fields
        ),
        sort: normalizeSort(criteria.order, metadata.fields),
    }
}

export const normalizeSavedWorkingListResource = ({
    resource,
    type,
    programId,
    metadata,
    parsingContext,
}: {
    resource: TrackedEntityInstanceFilter | ProgramStageWorkingList
    type: SavedListResource
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
}): NormalizedSavedWorkingList => {
    resource =
        type === 'trackedEntityInstanceFilters'
            ? TrackedEntityInstanceFilterSchema.parse(resource)
            : ProgramStageWorkingListSchema.parse(resource)
    if (resource.program.id !== programId) {
        throw new Error(
            `Saved list ${resource.id} belongs to program ${resource.program.id}, not ${programId}`
        )
    }
    const base: SavedListBase = {
        id: resource.id,
        name: resource.displayName,
        resource: type,
        sortOrder: resource.sortOrder,
        sharing: getSharing(resource),
    }
    try {
        const configuration =
            type === 'trackedEntityInstanceFilters'
                ? normalizeTrackedEntityResource({
                      resource: resource as TrackedEntityInstanceFilter,
                      programId,
                      metadata,
                      parsingContext,
                  })
                : normalizeEventResource({
                      resource: resource as ProgramStageWorkingList,
                      programId,
                      metadata,
                      parsingContext,
                  })
        const references = validateConfigurationReferences(configuration, {
            expectedProgramId: programId,
            fields: metadata.fields,
            readableProgramStageIds: metadata.readableProgramStageIds,
        })
        if ('issues' in references) {
            return {
                ...base,
                compatibility: 'incompatible',
                issues: references.issues,
                raw: resource,
                candidateConfiguration: configuration,
            }
        }
        const unsupportedFilters = configuration.filters.flatMap(
            (filter, index) => {
                try {
                    validateAppliedFilter(filter, metadata.capabilities)
                    return []
                } catch (error) {
                    return [
                        {
                            kind: 'unsupportedFilter' as const,
                            referenceId: filter.field.id,
                            path: `filters.${index}.field`,
                            message:
                                error instanceof Error
                                    ? error.message
                                    : `Filter ${filter.field.id} is unsupported`,
                        },
                    ]
                }
            }
        )
        if (unsupportedFilters.length) {
            return {
                ...base,
                compatibility: 'incompatible',
                issues: unsupportedFilters,
                raw: resource,
                candidateConfiguration: configuration,
            }
        }
        return {
            ...base,
            compatibility: 'compatible',
            configuration,
            raw: resource,
        }
    } catch (error) {
        if (error instanceof StaleWorkingListError) {
            return {
                ...base,
                compatibility: 'incompatible',
                issues: error.issues,
                raw: resource,
            }
        }
        throw error
    }
}

export const fetchSavedWorkingLists = async ({
    client,
    programId,
    metadata,
    parsingContext,
    signal,
}: {
    client: WorkingListClient
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
    signal?: AbortSignal
}): Promise<NormalizedSavedWorkingList[]> => {
    const commonParams = {
        filter: `program.id:eq:${programId}`,
        paging: false,
    }
    const [trackedEntityResponse, eventResponse] = await Promise.all([
        client.query(
            {
                resource: 'trackedEntityInstanceFilters',
                params: {
                    ...commonParams,
                    fields: 'id,displayName,sortOrder,program,entityQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            TrackedEntityInstanceFiltersResponseSchema,
            signal
        ),
        client.query(
            {
                resource: 'programStageWorkingLists',
                params: {
                    ...commonParams,
                    fields: 'id,displayName,sortOrder,program,programStage,programStageQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            ProgramStageWorkingListsResponseSchema,
            signal
        ),
    ])
    try {
        return [
            ...trackedEntityResponse.trackedEntityInstanceFilters.map(
                (resource) =>
                    normalizeSavedWorkingListResource({
                        resource,
                        type: 'trackedEntityInstanceFilters',
                        programId,
                        metadata,
                        parsingContext,
                    })
            ),
            ...eventResponse.programStageWorkingLists.map((resource) =>
                normalizeSavedWorkingListResource({
                    resource,
                    type: 'programStageWorkingLists',
                    programId,
                    metadata,
                    parsingContext,
                })
            ),
        ].sort(
            (left, right) =>
                (left.sortOrder ?? Number.MAX_SAFE_INTEGER) -
                    (right.sortOrder ?? Number.MAX_SAFE_INTEGER) ||
                left.name.localeCompare(right.name)
        )
    } catch (error) {
        throw asWorkingListBoundaryError(error, 'Malformed saved-list response')
    }
}

export const savedWorkingListsQueryOptions = (
    input: Omit<Parameters<typeof fetchSavedWorkingLists>[0], 'signal'>
) =>
    queryOptions({
        queryKey: workingListQueryKeys.savedLists(input.programId),
        queryFn: ({ signal }) => fetchSavedWorkingLists({ ...input, signal }),
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryWorkingListRequest,
    })

const dateContents = (
    filter: AppliedFilter,
    serializationContext?: FilterSerializationContext
) => {
    const serialized = getValueTypeDefinition('DATE').serializeSaved(
        filter,
        serializationContext
    )
    if (!serialized.dateFilter) {
        throw new Error(`${filter.field.id} did not serialize to a dateFilter`)
    }
    return serialized.dateFilter
}

const commonCriteriaPayload = (
    configuration: WorkingListConfiguration,
    fields: FieldCatalog,
    serializationContext?: FilterSerializationContext
) => {
    const criteria: Record<string, unknown> = {
        displayColumnOrder: configuration.columns.map(
            (id) => fields.get(id)?.apiName ?? id
        ),
        order: `${fields.get(configuration.sort.fieldId)?.apiName ?? configuration.sort.fieldId}:${configuration.sort.direction}`,
    }
    const attributeValueFilters: SavedValueFilter[] = []
    const dataFilters: SavedValueFilter[] = []
    for (const filter of configuration.filters) {
        if (filter.field.source === 'trackedEntityAttribute') {
            attributeValueFilters.push({
                ...getValueTypeDefinition(
                    filter.field.valueType
                ).serializeSaved(filter, serializationContext),
                attribute: filter.field.id,
            })
            continue
        }
        if (filter.field.source === 'eventDataElement') {
            dataFilters.push({
                ...getValueTypeDefinition(
                    filter.field.valueType
                ).serializeSaved(filter, serializationContext),
                dataItem: filter.field.id,
            })
            continue
        }
        switch (filter.field.id) {
            case 'enrollmentStatus':
                criteria.enrollmentStatus =
                    filter.value.kind === 'options'
                        ? filter.value.values[0]
                        : undefined
                break
            case 'enrolledAt':
                criteria[
                    configuration.mode === 'trackedEntity'
                        ? 'enrollmentCreatedDate'
                        : 'enrolledAt'
                ] = dateContents(filter, serializationContext)
                break
            case 'enrollmentOccurredAt':
                criteria[
                    configuration.mode === 'trackedEntity'
                        ? 'enrollmentIncidentDate'
                        : 'enrollmentOccurredAt'
                ] = dateContents(filter, serializationContext)
                break
            case 'followUp':
                criteria.followUp =
                    filter.value.kind === 'boolean'
                        ? JSON.stringify(filter.value.values[0])
                        : undefined
                break
            case 'assignedUser':
            case 'eventAssignedUser':
                if (filter.value.kind === 'assignee') {
                    criteria.assignedUserMode = filter.value.mode
                    if (filter.value.userIds?.length) {
                        criteria.assignedUsers = filter.value.userIds
                    }
                }
                break
            case 'eventStatus':
                criteria.eventStatus =
                    filter.value.kind === 'options'
                        ? filter.value.values[0]
                        : undefined
                break
            case 'eventOccurredAt':
                criteria.eventOccurredAt = dateContents(
                    filter,
                    serializationContext
                )
                break
            case 'eventScheduledAt':
                criteria.eventScheduledAt = dateContents(
                    filter,
                    serializationContext
                )
                break
        }
    }
    if (attributeValueFilters.length) {
        criteria.attributeValueFilters = attributeValueFilters
    }
    if (dataFilters.length) {
        criteria.dataFilters = dataFilters
    }
    return criteria
}

const writableSharing = (sharing?: SavedListSharing) => {
    if (!sharing) {
        return {
            publicAccess: '--------',
            externalAccess: false,
            userAccesses: [] as SharingAccessEntry[],
            userGroupAccesses: [] as SharingAccessEntry[],
        }
    }
    return {
        ...(sharing.publicAccess !== undefined
            ? { publicAccess: sharing.publicAccess }
            : {}),
        ...(sharing.externalAccess !== undefined
            ? { externalAccess: sharing.externalAccess }
            : {}),
        ...(sharing.user !== undefined ? { user: { ...sharing.user } } : {}),
        ...(sharing.userAccesses !== undefined
            ? { userAccesses: [...sharing.userAccesses] }
            : {}),
        ...(sharing.userGroupAccesses !== undefined
            ? { userGroupAccesses: [...sharing.userGroupAccesses] }
            : {}),
    }
}

const SAVED_VALUE_FILTER_KEYS = new Set([
    'attribute',
    'dataItem',
    'eq',
    'sw',
    'ew',
    'like',
    'ge',
    'le',
    'in',
    'null',
    'dateFilter',
])

const DATE_FILTER_KEYS = new Set([
    'type',
    'startDate',
    'endDate',
    'period',
    'startBuffer',
    'endBuffer',
])

const COMMON_CRITERIA_KEYS = [
    'enrollmentStatus',
    'order',
    'displayColumnOrder',
    'assignedUserMode',
    'assignedUsers',
    'followUp',
    'attributeValueFilters',
] as const

const ENTITY_CRITERIA_KEYS = new Set([
    ...COMMON_CRITERIA_KEYS,
    'enrollmentCreatedDate',
    'enrollmentIncidentDate',
])

const STAGE_CRITERIA_KEYS = new Set([
    ...COMMON_CRITERIA_KEYS,
    'enrolledAt',
    'enrollmentOccurredAt',
    'eventStatus',
    'eventOccurredAt',
    'eventScheduledAt',
    'dataFilters',
])

const unknownFields = (
    source: Record<string, unknown> | undefined,
    knownKeys: ReadonlySet<string>
) =>
    source
        ? Object.fromEntries(
              Object.entries(source).filter(([key]) => !knownKeys.has(key))
          )
        : {}

const mergeDateFilterExtensions = (existing: unknown, next: unknown) => {
    if (
        !existing ||
        typeof existing !== 'object' ||
        !next ||
        typeof next !== 'object'
    ) {
        return next
    }
    return {
        ...unknownFields(existing as Record<string, unknown>, DATE_FILTER_KEYS),
        ...(next as Record<string, unknown>),
    }
}

const mergeSavedFilterExtensions = (
    existingFilters: unknown,
    nextFilters: unknown
) => {
    if (!Array.isArray(nextFilters)) {
        return nextFilters
    }
    const previous = Array.isArray(existingFilters)
        ? (existingFilters as Record<string, unknown>[])
        : []
    return (nextFilters as Record<string, unknown>[]).map((next) => {
        const reference = next.attribute ?? next.dataItem
        const existing = previous.find(
            (candidate) =>
                (candidate.attribute ?? candidate.dataItem) === reference
        )
        if (!existing) {
            return next
        }
        return {
            ...unknownFields(existing, SAVED_VALUE_FILTER_KEYS),
            ...next,
            ...(next.dateFilter
                ? {
                      dateFilter: mergeDateFilterExtensions(
                          existing.dateFilter,
                          next.dateFilter
                      ),
                  }
                : {}),
        }
    })
}

const mergeCriteriaExtensions = (
    existing: Record<string, unknown> | undefined,
    next: Record<string, unknown>,
    resource: SavedListResource
) => {
    if (!existing) {
        return next
    }
    const knownKeys =
        resource === 'trackedEntityInstanceFilters'
            ? ENTITY_CRITERIA_KEYS
            : STAGE_CRITERIA_KEYS
    const merged: Record<string, unknown> = {
        ...unknownFields(existing, knownKeys),
        ...next,
    }
    for (const key of [
        'enrollmentCreatedDate',
        'enrollmentIncidentDate',
        'enrolledAt',
        'enrollmentOccurredAt',
        'eventOccurredAt',
        'eventScheduledAt',
    ]) {
        if (next[key] !== undefined) {
            merged[key] = mergeDateFilterExtensions(existing[key], next[key])
        }
    }
    for (const key of ['attributeValueFilters', 'dataFilters']) {
        if (next[key] !== undefined) {
            merged[key] = mergeSavedFilterExtensions(existing[key], next[key])
        }
    }
    return merged
}

export const buildSavedListPayload = ({
    name,
    configuration,
    fields,
    capabilities,
    sharing,
    serializationContext,
    existingResource,
}: {
    name: string
    configuration: WorkingListConfiguration
    fields: FieldCatalog
    capabilities: WorkingListCapabilities
    sharing?: SavedListSharing
    serializationContext?: FilterSerializationContext
    /** Existing parsed metadata used only for writable round-trip state. */
    existingResource?: TrackedEntityInstanceFilter | ProgramStageWorkingList
}) => {
    const parsedName = z.string().trim().min(1).parse(name)
    const parsedConfiguration = WorkingListConfigurationSchema.parse(
        configuration
    ) as WorkingListConfiguration
    const missingFieldIds = [
        ...parsedConfiguration.columns,
        parsedConfiguration.sort.fieldId,
        ...parsedConfiguration.filters.map((filter) => filter.field.id),
    ].filter((id) => !fields.has(id))
    if (missingFieldIds.length) {
        throw new StaleWorkingListError(
            [...new Set(missingFieldIds)].map((id) =>
                getMissingIssue(id, 'configuration')
            )
        )
    }
    const validatedConfiguration: WorkingListConfiguration = {
        ...parsedConfiguration,
        filters: parsedConfiguration.filters.map((filter) => {
            const currentField = fields.get(filter.field.id)!
            if (
                parsedConfiguration.mode === 'event' &&
                currentField.source === 'eventDataElement' &&
                !currentField.programStageIds?.includes(
                    parsedConfiguration.programStageId
                )
            ) {
                throw new Error(
                    `Event data element ${currentField.id} does not belong to stage ${parsedConfiguration.programStageId}`
                )
            }
            return validateAppliedFilter(
                { ...filter, field: currentField },
                capabilities,
                serializationContext
            )
        }),
    }
    if (validatedConfiguration.mode === 'event') {
        for (const fieldId of [
            ...validatedConfiguration.columns,
            validatedConfiguration.sort.fieldId,
        ]) {
            const field = fields.get(fieldId)!
            if (
                field.source === 'eventDataElement' &&
                !field.programStageIds?.includes(
                    validatedConfiguration.programStageId
                )
            ) {
                throw new Error(
                    `Event data element ${field.id} does not belong to stage ${validatedConfiguration.programStageId}`
                )
            }
        }
    }
    const resource: SavedListResource =
        validatedConfiguration.mode === 'trackedEntity'
            ? 'trackedEntityInstanceFilters'
            : 'programStageWorkingLists'
    const existingIsStage =
        existingResource !== undefined && 'programStage' in existingResource
    if (
        existingResource &&
        (existingResource.program.id !== validatedConfiguration.programId ||
            (resource === 'programStageWorkingLists') !== existingIsStage)
    ) {
        throw new Error(
            'Existing saved-list resource does not match the replacement configuration'
        )
    }
    const common = {
        name: parsedName,
        program: { id: validatedConfiguration.programId },
        ...(existingResource?.sortOrder !== undefined
            ? { sortOrder: existingResource.sortOrder }
            : {}),
        ...writableSharing(
            sharing ??
                (existingResource ? getSharing(existingResource) : undefined)
        ),
    }
    const criteria = mergeCriteriaExtensions(
        existingResource
            ? resource === 'trackedEntityInstanceFilters'
                ? (existingResource as TrackedEntityInstanceFilter)
                      .entityQueryCriteria
                : (existingResource as ProgramStageWorkingList)
                      .programStageQueryCriteria
            : undefined,
        commonCriteriaPayload(
            validatedConfiguration,
            fields,
            serializationContext
        ),
        resource
    )
    return validatedConfiguration.mode === 'trackedEntity'
        ? {
              resource: 'trackedEntityInstanceFilters' as const,
              data: { ...common, entityQueryCriteria: criteria },
          }
        : {
              resource: 'programStageWorkingLists' as const,
              data: {
                  ...common,
                  programStage: {
                      id: validatedConfiguration.programStageId,
                  },
                  programStageQueryCriteria: criteria,
              },
          }
}

export type SavedWorkingListRepairResult =
    | {
          status: 'repaired'
          configuration: WorkingListConfiguration
          payload: ReturnType<typeof buildSavedListPayload>
      }
    | { status: 'blocked'; issues: StaleReferenceIssue[] }

const unsupportedFilterIssues = (
    configuration: WorkingListConfiguration,
    metadata: ProgramFieldCatalog
) =>
    configuration.filters.flatMap((filter, index) => {
        try {
            validateAppliedFilter(filter, metadata.capabilities)
            return []
        } catch (error) {
            return [
                {
                    kind: 'unsupportedFilter' as const,
                    referenceId: filter.field.id,
                    path: `filters.${index}.field`,
                    message:
                        error instanceof Error
                            ? error.message
                            : `Filter ${filter.field.id} is unsupported`,
                },
            ]
        }
    })

const cloneSavedResource = (
    list: Extract<NormalizedSavedWorkingList, { compatibility: 'incompatible' }>
): TrackedEntityInstanceFilter | ProgramStageWorkingList => {
    if (list.resource === 'trackedEntityInstanceFilters') {
        const raw = list.raw as TrackedEntityInstanceFilter
        const criteria = raw.entityQueryCriteria
        return {
            ...raw,
            entityQueryCriteria: criteria
                ? {
                      ...criteria,
                      attributeValueFilters:
                          criteria.attributeValueFilters?.map((filter) => ({
                              ...filter,
                          })),
                      displayColumnOrder: criteria.displayColumnOrder
                          ? [...criteria.displayColumnOrder]
                          : undefined,
                  }
                : {},
        }
    }
    const raw = list.raw as ProgramStageWorkingList
    const criteria = raw.programStageQueryCriteria
    return {
        ...raw,
        programStage: { ...raw.programStage },
        programStageQueryCriteria: criteria
            ? {
                  ...criteria,
                  attributeValueFilters: criteria.attributeValueFilters?.map(
                      (filter) => ({
                          ...filter,
                      })
                  ),
                  dataFilters: criteria.dataFilters?.map((filter) => ({
                      ...filter,
                  })),
                  displayColumnOrder: criteria.displayColumnOrder
                      ? [...criteria.displayColumnOrder]
                      : undefined,
              }
            : {},
    }
}

const repairRawFilter = ({
    savedFilter,
    decision,
    expectedSource,
    metadata,
    serializationContext,
}: {
    savedFilter: SavedValueFilter
    decision: StaleReferenceRepairDecision
    expectedSource: 'trackedEntityAttribute' | 'eventDataElement'
    metadata: ProgramFieldCatalog
    serializationContext?: FilterSerializationContext
}): SavedValueFilter | undefined => {
    if (decision.action === 'remove') {
        return undefined
    }
    if (decision.action !== 'replaceFilter') {
        throw new Error('A stale saved filter requires remove or replaceFilter')
    }
    const currentField = metadata.fields.get(decision.filter.field.id)
    if (!currentField || currentField.source !== expectedSource) {
        throw new Error(
            `Replacement filter ${decision.filter.field.id} has the wrong source`
        )
    }
    const filter = validateAppliedFilter(
        { ...decision.filter, field: currentField },
        metadata.capabilities,
        serializationContext
    )
    const serialized = getValueTypeDefinition(
        currentField.valueType
    ).serializeSaved(filter, serializationContext)
    const knownKeys = new Set([
        'attribute',
        'dataItem',
        'eq',
        'sw',
        'ew',
        'like',
        'ge',
        'le',
        'in',
        'null',
        'dateFilter',
    ])
    const additionalFields = Object.fromEntries(
        Object.entries(savedFilter).filter(([key]) => !knownKeys.has(key))
    )
    return expectedSource === 'trackedEntityAttribute'
        ? {
              ...additionalFields,
              ...serialized,
              attribute: currentField.id,
          }
        : { ...additionalFields, ...serialized, dataItem: currentField.id }
}

const blockedRepair = (
    issue: StaleReferenceIssue
): SavedWorkingListRepairResult => ({ status: 'blocked', issues: [issue] })

/**
 * Repairs a saved resource only from explicit, path-addressed choices. The
 * returned payload is replacement-ready and retains writable sharing.
 */
export const repairSavedWorkingList = ({
    list,
    decisions,
    programId,
    metadata,
    parsingContext,
    serializationContext,
}: {
    list: Extract<NormalizedSavedWorkingList, { compatibility: 'incompatible' }>
    decisions: StaleReferenceRepairDecision[]
    programId: string
    metadata: ProgramFieldCatalog
    parsingContext?: FilterParsingContext
    serializationContext?: FilterSerializationContext
}): SavedWorkingListRepairResult => {
    if (list.candidateConfiguration) {
        const result = repairConfigurationReferences({
            configuration: list.candidateConfiguration,
            issues: list.issues,
            decisions,
            metadata: {
                expectedProgramId: programId,
                fields: metadata.fields,
                readableProgramStageIds: metadata.readableProgramStageIds,
            },
        })
        if (result.status === 'blocked') {
            return result
        }
        const unsupported = unsupportedFilterIssues(
            result.configuration,
            metadata
        )
        if (unsupported.length) {
            return { status: 'blocked', issues: unsupported }
        }
        return {
            status: 'repaired',
            configuration: result.configuration,
            payload: buildSavedListPayload({
                name: list.name,
                configuration: result.configuration,
                fields: metadata.fields,
                capabilities: metadata.capabilities,
                sharing: list.sharing,
                serializationContext,
                existingResource: list.raw,
            }),
        }
    }

    const decisionsByPath = new Map(
        decisions.map((decision) => [decision.path, decision])
    )
    if (decisionsByPath.size !== decisions.length) {
        throw new Error('A repair plan cannot contain duplicate paths')
    }
    const unresolved = list.issues.find(
        (issue) =>
            issue.kind === 'programMismatch' ||
            issue.kind === 'missingProgramStage' ||
            !decisionsByPath.has(issue.path)
    )
    if (unresolved) {
        return blockedRepair(unresolved)
    }

    const raw = cloneSavedResource(list)
    const criteria =
        list.resource === 'trackedEntityInstanceFilters'
            ? (raw as TrackedEntityInstanceFilter).entityQueryCriteria!
            : (raw as ProgramStageWorkingList).programStageQueryCriteria!

    for (const issue of list.issues) {
        const decision = decisionsByPath.get(issue.path)!
        const attributeMatch = issue.path.match(
            /^attributeValueFilters\.(\d+)\.attribute$/
        )
        const dataMatch = issue.path.match(/^dataFilters\.(\d+)\.dataItem$/)
        const columnMatch = issue.path.match(/^displayColumnOrder\.(\d+)$/)
        if (attributeMatch) {
            const index = Number(attributeMatch[1])
            const savedFilter = criteria.attributeValueFilters?.[index]
            if (!savedFilter) {
                return blockedRepair(issue)
            }
            try {
                criteria.attributeValueFilters![index] = repairRawFilter({
                    savedFilter,
                    decision,
                    expectedSource: 'trackedEntityAttribute',
                    metadata,
                    serializationContext,
                }) as never
            } catch (error) {
                return blockedRepair({
                    ...issue,
                    kind: 'unsupportedFilter',
                    message:
                        error instanceof Error ? error.message : String(error),
                })
            }
            continue
        }
        if (dataMatch && list.resource === 'programStageWorkingLists') {
            const stageCriteria = criteria as ProgramStageQueryCriteria
            const index = Number(dataMatch[1])
            const savedFilter = stageCriteria.dataFilters?.[index]
            if (!savedFilter) {
                return blockedRepair(issue)
            }
            try {
                stageCriteria.dataFilters![index] = repairRawFilter({
                    savedFilter,
                    decision,
                    expectedSource: 'eventDataElement',
                    metadata,
                    serializationContext,
                }) as never
            } catch (error) {
                return blockedRepair({
                    ...issue,
                    kind: 'unsupportedFilter',
                    message:
                        error instanceof Error ? error.message : String(error),
                })
            }
            continue
        }
        if (columnMatch && criteria.displayColumnOrder) {
            const index = Number(columnMatch[1])
            if (decision.action === 'remove') {
                criteria.displayColumnOrder[index] = undefined as never
            } else if (decision.action === 'replaceColumn') {
                const field = metadata.fields.get(decision.fieldId)
                if (!field) {
                    return blockedRepair(issue)
                }
                criteria.displayColumnOrder[index] = field.apiName ?? field.id
            } else {
                return blockedRepair(issue)
            }
            continue
        }
        if (issue.path === 'order') {
            if (decision.action === 'remove') {
                criteria.order = undefined
            } else if (decision.action === 'replaceSort') {
                const field = metadata.fields.get(decision.sort.fieldId)
                if (!field) {
                    return blockedRepair(issue)
                }
                criteria.order = `${field.apiName ?? field.id}:${decision.sort.direction}`
            } else {
                return blockedRepair(issue)
            }
            continue
        }
        return blockedRepair(issue)
    }

    criteria.attributeValueFilters =
        criteria.attributeValueFilters?.filter(Boolean)
    if ('dataFilters' in criteria) {
        const stageCriteria = criteria as ProgramStageQueryCriteria
        stageCriteria.dataFilters = stageCriteria.dataFilters?.filter(Boolean)
    }
    criteria.displayColumnOrder = criteria.displayColumnOrder?.filter(Boolean)
    if (criteria.displayColumnOrder && !criteria.displayColumnOrder.length) {
        return {
            status: 'blocked',
            issues: [
                {
                    kind: 'noVisibleColumns',
                    referenceId: '',
                    path: 'displayColumnOrder',
                    message:
                        'A working list requires at least one visible column',
                },
            ],
        }
    }

    const normalized = normalizeSavedWorkingListResource({
        resource: raw,
        type: list.resource,
        programId,
        metadata,
        parsingContext,
    })
    if (normalized.compatibility === 'incompatible') {
        return { status: 'blocked', issues: normalized.issues }
    }
    return {
        status: 'repaired',
        configuration: normalized.configuration,
        payload: buildSavedListPayload({
            name: list.name,
            configuration: normalized.configuration,
            fields: metadata.fields,
            capabilities: metadata.capabilities,
            sharing: list.sharing,
            serializationContext,
            existingResource: raw,
        }),
    }
}

export const createSavedWorkingList = async ({
    client,
    ...input
}: Parameters<typeof buildSavedListPayload>[0] & {
    client: WorkingListClient
}) => {
    const payload = buildSavedListPayload(input)
    const response = await client.mutate(
        { resource: payload.resource, type: 'create', data: payload.data },
        MutationResponseSchema
    )
    const id = response.response?.uid
    if (!id) {
        throw new Error('Create saved-list response did not contain a UID')
    }
    return id
}

export const createSavedWorkingListMutationOptions = () =>
    mutationOptions({
        mutationFn: createSavedWorkingList,
    })

export const replaceSavedWorkingList = async ({
    client,
    id,
    resource,
    existingResource,
    ...input
}: Parameters<typeof buildSavedListPayload>[0] & {
    client: WorkingListClient
    id: string
    resource: SavedListResource
}) => {
    const expectedResource =
        input.configuration.mode === 'trackedEntity'
            ? 'trackedEntityInstanceFilters'
            : 'programStageWorkingLists'
    if (expectedResource !== resource) {
        throw new Error(
            `Cannot replace ${resource} with ${expectedResource} configuration`
        )
    }
    const currentResource =
        existingResource ??
        (await client.query(
            {
                resource,
                id,
                params: {
                    fields:
                        resource === 'trackedEntityInstanceFilters'
                            ? 'id,displayName,sortOrder,program,entityQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses'
                            : 'id,displayName,sortOrder,program,programStage,programStageQueryCriteria,access,externalAccess,publicAccess,user,userAccesses,userGroupAccesses',
                },
            },
            resource === 'trackedEntityInstanceFilters'
                ? TrackedEntityInstanceFilterSchema
                : ProgramStageWorkingListSchema
        ))
    if (currentResource.id !== id) {
        throw new Error(
            `Loaded saved-list ${currentResource.id} while replacing ${id}`
        )
    }
    const payload = buildSavedListPayload({
        ...input,
        existingResource: currentResource,
    })
    if (payload.resource !== resource) {
        throw new Error(
            `Cannot replace ${resource} with ${payload.resource} configuration`
        )
    }
    await client.mutate(
        {
            resource,
            id,
            type: 'replace',
            data: payload.data,
        },
        MutationResponseSchema
    )
}

export const replaceSavedWorkingListMutationOptions = () =>
    mutationOptions({
        mutationFn: replaceSavedWorkingList,
    })

export const deleteSavedWorkingList = async (
    client: WorkingListClient,
    resource: SavedListResource,
    id: string
) =>
    client.mutate(
        { resource, id, type: 'delete' },
        DeleteMutationResponseSchema
    )

export const getSharingType = (resource: SavedListResource) =>
    resource === 'trackedEntityInstanceFilters'
        ? 'trackedEntityInstanceFilter'
        : 'programStageWorkingList'

/**
 * Capture parity: the unfiltered fallback view is a client-side template
 * whose id concatenates the program id with `-default`. Because the id is
 * written to the URL like any saved list, deselecting a list survives a
 * page reload instead of snapping back to the first available list.
 */
export const defaultWorkingListId = (programId: string) =>
    `${programId}-default`

export const createDefaultWorkingList = ({
    programId,
    columns,
}: {
    programId: string
    columns: string[]
}): Extract<NormalizedSavedWorkingList, { compatibility: 'compatible' }> => ({
    id: defaultWorkingListId(programId),
    name: 'default',
    resource: 'trackedEntityInstanceFilters',
    sharing: {},
    compatibility: 'compatible',
    configuration: {
        mode: 'trackedEntity',
        programId,
        filters: [],
        columns,
        sort: { ...DEFAULT_WORKING_LIST_SORT },
    },
})

export const createGeneratedDefaultLists = ({
    programId,
    columns,
    fields,
}: {
    programId: string
    columns: string[]
    fields: FieldCatalog
}): NormalizedSavedWorkingList[] => {
    const statusField = fields.get('enrollmentStatus')
    if (!statusField) {
        return []
    }
    return [
        [
            'active',
            'Active enrollments',
            'workingList.defaults.active',
            'ACTIVE',
        ],
        [
            'completed',
            'Completed enrollments',
            'workingList.defaults.completed',
            'COMPLETED',
        ],
        [
            'cancelled',
            'Cancelled enrollments',
            'workingList.defaults.cancelled',
            'CANCELLED',
        ],
    ].map(([id, name, labelKey, status], sortOrder) => ({
        id,
        name,
        labelKey,
        resource: 'trackedEntityInstanceFilters' as const,
        sortOrder,
        sharing: {},
        compatibility: 'compatible' as const,
        configuration: {
            mode: 'trackedEntity' as const,
            programId,
            filters: [
                {
                    field: statusField,
                    operator: 'in' as const,
                    value: { kind: 'options' as const, values: [status] },
                },
            ],
            columns,
            sort: { ...DEFAULT_WORKING_LIST_SORT },
        },
    }))
}
