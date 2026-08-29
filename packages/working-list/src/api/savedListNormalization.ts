import type {
    AppliedFilter,
    FieldCatalog,
    FilterOperator,
    FilterValue,
    WorkingListConfiguration,
    WorkingListField,
    WorkingListSort,
} from '../domain/model'
import {
    StaleWorkingListError,
    validateConfigurationReferences,
} from '../domain/staleReferences'
import type { StaleReferenceIssue } from '../domain/staleReferences'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import { validateSystemFilter } from '../registry/systemFilters'
import {
    getValueTypeDefinition,
    validateAppliedFilter,
} from '../registry/valueTypes'
import type { FilterParsingContext } from '../registry/valueTypes'
import {
    fieldsForConfiguration,
    fieldsForProgramStage,
    type ProgramFieldCatalog,
} from './metadata'
import {
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
} from './schemas'
import type {
    EntityQueryCriteria,
    ProgramStageQueryCriteria,
    ProgramStageWorkingList,
    SavedValueFilter,
    TrackedEntityInstanceFilter,
} from './schemas'
import type {
    NormalizedSavedWorkingList,
    SavedListBase,
    SavedListResource,
    SavedListSharing,
} from './savedListContracts'

export const getSharing = (
    resource: TrackedEntityInstanceFilter | ProgramStageWorkingList
): SavedListSharing => ({
    access: resource.access,
    externalAccess: resource.externalAccess,
    publicAccess: resource.publicAccess,
    user: resource.user,
    userAccesses: resource.userAccesses,
    userGroupAccesses: resource.userGroupAccesses,
})

export const findField = (fields: FieldCatalog, idOrApiName: string) =>
    fields.get(idOrApiName) ??
    [...fields.values()].find((field) => field.apiName === idOrApiName)

export const getMissingIssue = (
    referenceId: string,
    path: string,
    kind: StaleReferenceIssue['kind'] = 'missingFilterField'
): StaleReferenceIssue => ({
    kind,
    referenceId,
    path,
    message: `Saved list references unavailable ${referenceId} at ${path}`,
})

export const getSavedFilterOperator = (
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

export const normalizeValueFilter = (
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

export const normalizeDateValue = (
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

export const systemFilter = (
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

export const normalizeCommonCriteria = (
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

export const normalizeColumns = (
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

export const normalizeSort = (
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

export const normalizeTrackedEntityResource = ({
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

export const normalizeEventResource = ({
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
    const fields = fieldsForProgramStage(metadata, programStageId)
    const criteria = resource.programStageQueryCriteria ?? {}
    const filters = normalizeCommonCriteria(criteria, fields, parsingContext)
    if (criteria.enrolledAt) {
        filters.push(
            systemFilter(fields, {
                id: 'enrolledAt',
                operator: 'range',
                value: normalizeDateValue(criteria.enrolledAt, parsingContext),
            })
        )
    }
    if (criteria.enrollmentOccurredAt) {
        filters.push(
            systemFilter(fields, {
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
            systemFilter(fields, {
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
            systemFilter(fields, {
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
            systemFilter(fields, {
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
            systemFilter(fields, {
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
        const field = fields.get(savedFilter.dataItem)
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
            fields
        ),
        sort: normalizeSort(criteria.order, fields),
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
    const parsed =
        type === 'trackedEntityInstanceFilters'
            ? {
                  type: 'trackedEntityInstanceFilters' as const,
                  resource: TrackedEntityInstanceFilterSchema.parse(resource),
              }
            : {
                  type: 'programStageWorkingLists' as const,
                  resource: ProgramStageWorkingListSchema.parse(resource),
              }
    if (parsed.resource.program.id !== programId) {
        throw new Error(
            `Saved list ${parsed.resource.id} belongs to program ${parsed.resource.program.id}, not ${programId}`
        )
    }
    const base: SavedListBase = {
        id: parsed.resource.id,
        name: parsed.resource.displayName,
        resource: type,
        sortOrder: parsed.resource.sortOrder,
        sharing: getSharing(parsed.resource),
    }
    try {
        const configuration =
            parsed.type === 'trackedEntityInstanceFilters'
                ? normalizeTrackedEntityResource({
                      resource: parsed.resource,
                      programId,
                      metadata,
                      parsingContext,
                  })
                : normalizeEventResource({
                      resource: parsed.resource,
                      programId,
                      metadata,
                      parsingContext,
                  })
        const references = validateConfigurationReferences(configuration, {
            expectedProgramId: programId,
            fields: fieldsForConfiguration(metadata, configuration),
            readableProgramStageIds: metadata.readableProgramStageIds,
        })
        if ('issues' in references) {
            return {
                ...base,
                compatibility: 'incompatible',
                issues: references.issues,
                raw: parsed.resource,
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
                raw: parsed.resource,
                candidateConfiguration: configuration,
            }
        }
        return {
            ...base,
            compatibility: 'compatible',
            configuration,
            raw: parsed.resource,
        }
    } catch (error) {
        if (error instanceof StaleWorkingListError) {
            return {
                ...base,
                compatibility: 'incompatible',
                issues: error.issues,
                raw: parsed.resource,
            }
        }
        throw error
    }
}
