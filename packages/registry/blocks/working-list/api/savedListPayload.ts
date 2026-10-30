import { z } from 'zod'
import type {
    AppliedFilter,
    FieldCatalog,
    WorkingListConfiguration,
} from '../domain/model'
import { WorkingListConfigurationSchema } from '../domain/schemas'
import { StaleWorkingListError } from '../domain/staleReferences'
import {
    getValueTypeDefinition,
    validateAppliedFilter,
} from '../registry/valueTypes'
import type { FilterSerializationContext } from '../registry/valueTypes'
import type { WorkingListCapabilities } from './capabilities'
import {
    DateFilterContentsSchema,
    ProgramStageWorkingListSchema,
    TrackerEnrollmentStatusSchema,
    TrackerEventStatusSchema,
    TrackedEntityInstanceFilterSchema,
} from './schemas'
import type {
    ProgramStageWorkingList,
    SavedValueFilter,
    TrackedEntityInstanceFilter,
} from './schemas'
import type {
    SavedDateFilter,
    SavedListPayloadBase,
    SavedListResource,
    SavedListSharing,
    WritableSavedCriteria,
} from './savedListContracts'
import { getMissingIssue, getSharing } from './savedListNormalization'

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
    return DateFilterContentsSchema.parse(serialized.dateFilter)
}

const followUpContents = (
    value: AppliedFilter['value']
): WritableSavedCriteria['followUp'] => {
    if (value.kind !== 'boolean') return undefined
    return value.values[0] ? 'true' : 'false'
}

const commonCriteriaPayload = (
    configuration: WorkingListConfiguration,
    fields: FieldCatalog,
    serializationContext?: FilterSerializationContext
) => {
    const criteria: WritableSavedCriteria = {
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
                        ? TrackerEnrollmentStatusSchema.optional().parse(
                              filter.value.values[0]
                          )
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
                criteria.followUp = followUpContents(filter.value)
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
                        ? TrackerEventStatusSchema.optional().parse(
                              filter.value.values[0]
                          )
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

const writableSharing = (sharing?: SavedListSharing): SavedListSharing => {
    if (!sharing) {
        return {
            publicAccess: '--------',
            externalAccess: false,
            userAccesses: [],
            userGroupAccesses: [],
        }
    }
    const writable: SavedListSharing = {}
    if (sharing.publicAccess !== undefined) {
        writable.publicAccess = sharing.publicAccess
    }
    if (sharing.externalAccess !== undefined) {
        writable.externalAccess = sharing.externalAccess
    }
    if (sharing.user !== undefined) {
        writable.user = { ...sharing.user }
    }
    if (sharing.userAccesses !== undefined) {
        writable.userAccesses = [...sharing.userAccesses]
    }
    if (sharing.userGroupAccesses !== undefined) {
        writable.userGroupAccesses = [...sharing.userGroupAccesses]
    }
    return writable
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

const unknownFields = <Source extends object>(
    source: Source | undefined,
    knownKeys: ReadonlySet<string>
) =>
    source
        ? Object.fromEntries(
              Object.entries(source).filter(([key]) => !knownKeys.has(key))
          )
        : {}

const mergeDateFilterExtensions = (
    existing: SavedDateFilter | null | undefined,
    next: SavedDateFilter | null | undefined
) => {
    if (!existing || !next) {
        return next
    }
    return {
        ...unknownFields(existing, DATE_FILTER_KEYS),
        ...next,
    }
}

const mergeSavedFilterExtensions = (
    existingFilters: SavedValueFilter[] | null | undefined,
    nextFilters: SavedValueFilter[] | null | undefined
) => {
    if (!nextFilters) {
        return nextFilters
    }
    const previous = existingFilters ?? []
    return nextFilters.map((next) => {
        const reference = next.attribute ?? next.dataItem
        const existing = previous.find(
            (candidate) =>
                (candidate.attribute ?? candidate.dataItem) === reference
        )
        if (!existing) {
            return next
        }
        const merged: SavedValueFilter = {
            ...unknownFields(existing, SAVED_VALUE_FILTER_KEYS),
            ...next,
        }
        if (next.dateFilter) {
            merged.dateFilter = mergeDateFilterExtensions(
                existing.dateFilter,
                next.dateFilter
            )
        }
        return merged
    })
}

const mergeCriteriaExtensions = (
    existing: WritableSavedCriteria | undefined,
    next: WritableSavedCriteria,
    resource: SavedListResource
) => {
    if (!existing) {
        return next
    }
    const knownKeys =
        resource === 'trackedEntityInstanceFilters'
            ? ENTITY_CRITERIA_KEYS
            : STAGE_CRITERIA_KEYS
    const merged: WritableSavedCriteria = {
        ...unknownFields(existing, knownKeys),
        ...next,
    }
    const dateKeys = [
        'enrollmentCreatedDate',
        'enrollmentIncidentDate',
        'enrolledAt',
        'enrollmentOccurredAt',
        'eventOccurredAt',
        'eventScheduledAt',
    ] as const
    for (const key of dateKeys) {
        if (next[key] !== undefined) {
            merged[key] = mergeDateFilterExtensions(existing[key], next[key])
        }
    }
    const filterKeys = ['attributeValueFilters', 'dataFilters'] as const
    for (const key of filterKeys) {
        if (next[key] !== undefined) {
            merged[key] = mergeSavedFilterExtensions(existing[key], next[key])
        }
    }
    return merged
}

const getExistingCriteria = (
    existingResource:
        | TrackedEntityInstanceFilter
        | ProgramStageWorkingList
        | undefined,
    resource: SavedListResource
): WritableSavedCriteria | undefined => {
    if (!existingResource) return undefined
    return resource === 'programStageWorkingLists'
        ? ProgramStageWorkingListSchema.parse(existingResource)
              .programStageQueryCriteria
        : TrackedEntityInstanceFilterSchema.parse(existingResource)
              .entityQueryCriteria
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
    const parsedConfiguration =
        WorkingListConfigurationSchema.parse(configuration)
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
            const currentField = fields.get(filter.field.id)
            if (!currentField) {
                throw new StaleWorkingListError([
                    getMissingIssue(filter.field.id, 'configuration.filters'),
                ])
            }
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
            const field = fields.get(fieldId)
            if (!field) {
                throw new StaleWorkingListError([
                    getMissingIssue(fieldId, 'configuration.columns'),
                ])
            }
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
    const common: SavedListPayloadBase = {
        name: parsedName,
        program: { id: validatedConfiguration.programId },
        ...writableSharing(
            sharing ??
                (existingResource ? getSharing(existingResource) : undefined)
        ),
    }
    if (existingResource?.sortOrder !== undefined) {
        common.sortOrder = existingResource.sortOrder
    }
    const existingCriteria = getExistingCriteria(existingResource, resource)
    const criteria = mergeCriteriaExtensions(
        existingCriteria,
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
