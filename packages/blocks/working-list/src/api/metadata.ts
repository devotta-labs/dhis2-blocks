import { queryOptions } from '@tanstack/react-query'
import type { FieldCatalog, WorkingListField } from '../domain/model'
import { workingListQueryKeys } from '../query/keys'
import {
    systemColumnFields,
    systemFilterRegistry,
} from '../registry/systemFilters'
import type { WorkingListCapabilities } from './capabilities'
import { shouldRetryWorkingListRequest, type WorkingListClient } from './client'
import {
    TrackerProgramSchema,
    TrackerProgramsResponseSchema,
    type TrackerProgram,
} from './schemas'

const searchMetadataFields = (apiVersion: number) =>
    apiVersion >= 43
        ? ',preferredSearchOperator,blockedSearchOperators,minCharactersToSearch'
        : ''

export const getProgramMetadataFields = (apiVersion: number) =>
    [
        'id',
        'displayName',
        'programType',
        'displayEnrollmentDateLabel',
        'displayIncidentDate',
        'displayIncidentDateLabel',
        'trackedEntityType[id,displayName]',
        'access',
        `programTrackedEntityAttributes[displayInList,mandatory,searchable${searchMetadataFields(apiVersion)},trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,searchable${searchMetadataFields(apiVersion)},optionSet[id,displayName,options[id,code,displayName]]]]`,
        'programStages[id,displayName,displayExecutionDateLabel,displayDueDateLabel,hideDueDate,enableUserAssignment,access,programStageDataElements[displayInReports,compulsory,dataElement[id,displayName,displayFormName,valueType,optionSet[id,displayName,options[id,code,displayName]]]]]',
    ].join(',')

export const PROGRAM_SUMMARY_FIELDS = 'id,displayName,programType,access'

export const fetchTrackerProgram = (
    client: WorkingListClient,
    {
        programId,
        signal,
        apiVersion,
    }: {
        programId: string
        signal?: AbortSignal
        apiVersion: number
    }
) =>
    client.query(
        {
            resource: 'programs',
            id: programId,
            params: { fields: getProgramMetadataFields(apiVersion) },
        },
        TrackerProgramSchema,
        signal
    )

export const fetchTrackerPrograms = (
    client: WorkingListClient,
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'programs',
            params: {
                fields: PROGRAM_SUMMARY_FIELDS,
                paging: false,
                filter: 'programType:eq:WITH_REGISTRATION',
            },
        },
        TrackerProgramsResponseSchema,
        signal
    )

export const trackerProgramQueryOptions = (
    client: WorkingListClient,
    programId: string,
    apiVersion: number
) =>
    queryOptions({
        queryKey: workingListQueryKeys.programMetadata(programId, apiVersion),
        queryFn: ({ signal }) =>
            fetchTrackerProgram(client, { programId, signal, apiVersion }),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: shouldRetryWorkingListRequest,
    })

export const trackerProgramsQueryOptions = (
    client: WorkingListClient,
    apiVersion: number
) =>
    queryOptions({
        queryKey: [
            ...workingListQueryKeys.all,
            'metadata',
            'programs',
            apiVersion,
        ] as const,
        queryFn: ({ signal }) => fetchTrackerPrograms(client, signal),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: shouldRetryWorkingListRequest,
    })

const normalizeSearchOperator = (operator?: string | null) => {
    switch (operator) {
        case 'LIKE':
            return 'like'
        case 'SW':
            return 'startsWith'
        case 'EW':
            return 'endsWith'
        case 'EQ':
            return 'equals'
        case 'RANGE':
            return 'range'
        case 'GE':
            return 'greaterThanOrEqual'
        case 'LE':
            return 'lessThanOrEqual'
        case 'NULL':
            return 'empty'
        case '!NULL':
            return 'notEmpty'
        default:
            return undefined
    }
}

export interface ProgramFieldCatalog {
    fields: FieldCatalog
    fieldsByProgramStage: ReadonlyMap<string, FieldCatalog>
    capabilities: WorkingListCapabilities
    defaultTrackedEntityColumns: string[]
    defaultEventColumnsByStage: ReadonlyMap<string, string[]>
    readableProgramStageIds: ReadonlySet<string>
}

type ConfigurationWithMode =
    | { mode: 'trackedEntity' }
    | { mode: 'event'; programStageId: string }

export const fieldsForProgramStage = (
    metadata: ProgramFieldCatalog,
    programStageId?: string
) =>
    programStageId
        ? (metadata.fieldsByProgramStage.get(programStageId) ?? metadata.fields)
        : metadata.fields

export const fieldsForConfiguration = (
    metadata: ProgramFieldCatalog,
    configuration: ConfigurationWithMode
) =>
    fieldsForProgramStage(
        metadata,
        configuration.mode === 'event'
            ? configuration.programStageId
            : undefined
    )

const metadataLabel = (label: string | null | undefined) =>
    label?.trim() ? label : undefined

const withMetadataLabel = (
    field: WorkingListField,
    label: string | null | undefined
): WorkingListField => {
    const resolved = metadataLabel(label)
    return resolved
        ? { ...field, displayName: resolved, displayNameIsMetadata: true }
        : field
}

export const buildProgramFieldCatalog = ({
    program,
    capabilities,
    hasSelectedOrgUnit,
}: {
    program: TrackerProgram
    capabilities: WorkingListCapabilities
    hasSelectedOrgUnit: boolean
}): ProgramFieldCatalog => {
    const parsedProgram = TrackerProgramSchema.parse(program)
    const fields = new Map<string, WorkingListField>()
    systemColumnFields.forEach((field) => fields.set(field.id, field))
    systemFilterRegistry.forEach((definition) =>
        fields.set(definition.field.id, definition.field)
    )

    const enrolledAt = fields.get('enrolledAt')
    const enrollmentOccurredAt = fields.get('enrollmentOccurredAt')
    const assignedUser = fields.get('assignedUser')
    if (enrolledAt) {
        fields.set(
            enrolledAt.id,
            withMetadataLabel(
                enrolledAt,
                parsedProgram.displayEnrollmentDateLabel
            )
        )
    }
    if (enrollmentOccurredAt) {
        fields.set(enrollmentOccurredAt.id, {
            ...withMetadataLabel(
                enrollmentOccurredAt,
                parsedProgram.displayIncidentDateLabel
            ),
            filterable: parsedProgram.displayIncidentDate !== false,
        })
    }
    if (assignedUser) {
        fields.set(assignedUser.id, {
            ...assignedUser,
            filterable: parsedProgram.programStages.some(
                (stage) =>
                    stage.access?.read !== false &&
                    stage.enableUserAssignment === true
            ),
        })
    }

    const defaultTrackedEntityColumns: string[] = []
    for (const binding of parsedProgram.programTrackedEntityAttributes) {
        const attribute = binding.trackedEntityAttribute
        const preferredSearchOperator = capabilities.metadataSearchOperators
            ? normalizeSearchOperator(
                  binding.preferredSearchOperator ??
                      attribute.preferredSearchOperator
              )
            : undefined
        const blockedSearchOperators = capabilities.metadataSearchOperators
            ? (
                  binding.blockedSearchOperators ??
                  attribute.blockedSearchOperators
              )
                  ?.map(normalizeSearchOperator)
                  .filter(
                      (value): value is NonNullable<typeof value> =>
                          value !== undefined
                  )
            : undefined
        const field: WorkingListField = {
            id: attribute.id,
            apiName: attribute.id,
            displayName:
                attribute.displayFormName ||
                attribute.formName ||
                attribute.displayName,
            source: 'trackedEntityAttribute',
            scope: 'trackedEntity',
            valueType: attribute.valueType,
            optionSetId: attribute.optionSet?.id,
            options: attribute.optionSet?.options?.map((option) => ({
                code: option.code,
                displayName: option.displayName,
            })),
            unique: attribute.unique,
            searchable: binding.searchable ?? attribute.searchable,
            filterable:
                capabilities.supportsValueTypeFilter(attribute.valueType) &&
                (hasSelectedOrgUnit ||
                    Boolean(
                        binding.searchable ??
                        attribute.searchable ??
                        attribute.unique
                    )),
            preferredSearchOperator,
            blockedSearchOperators,
            minCharactersToSearch: capabilities.minimumSearchLength
                ? (binding.minCharactersToSearch ??
                  attribute.minCharactersToSearch)
                : undefined,
        }
        if (binding.mandatory) {
            field.required = true
        }
        fields.set(field.id, field)
        if (binding.displayInList) {
            defaultTrackedEntityColumns.push(field.id)
        }
    }

    if (!defaultTrackedEntityColumns.length) {
        defaultTrackedEntityColumns.push('createdAt')
    }

    const readableProgramStageIds = new Set<string>()
    const defaultEventColumnsByStage = new Map<string, string[]>()
    for (const stage of parsedProgram.programStages) {
        if (stage.access?.read === false) {
            continue
        }
        readableProgramStageIds.add(stage.id)
        const columns = [
            ...defaultTrackedEntityColumns,
            'eventStatus',
            'eventOccurredAt',
            ...(stage.hideDueDate === false ? ['eventScheduledAt'] : []),
            'eventOrgUnit',
            ...(stage.enableUserAssignment === true
                ? ['eventAssignedUser']
                : []),
        ]
        for (const binding of stage.programStageDataElements) {
            const dataElement = binding.dataElement
            const existing = fields.get(dataElement.id)
            if (
                existing &&
                (existing.source !== 'eventDataElement' ||
                    existing.valueType !== dataElement.valueType)
            ) {
                throw new Error(
                    `Data element ${dataElement.id} has inconsistent metadata`
                )
            }
            const requiredInStageIds = [
                ...new Set([
                    ...(existing?.requiredInStageIds ?? []),
                    ...(binding.compulsory ? [stage.id] : []),
                ]),
            ]
            const field: WorkingListField = {
                id: dataElement.id,
                apiName: dataElement.id,
                displayName:
                    dataElement.displayFormName ||
                    dataElement.formName ||
                    dataElement.displayName,
                source: 'eventDataElement',
                scope: 'event',
                valueType: dataElement.valueType,
                optionSetId: dataElement.optionSet?.id,
                options: dataElement.optionSet?.options?.map((option) => ({
                    code: option.code,
                    displayName: option.displayName,
                })),
                filterable: capabilities.supportsValueTypeFilter(
                    dataElement.valueType
                ),
                programStageIds: [
                    ...new Set([
                        ...(existing?.programStageIds ?? []),
                        stage.id,
                    ]),
                ],
            }
            if (requiredInStageIds.length) {
                field.requiredInStageIds = requiredInStageIds
            }
            fields.set(field.id, field)
            if (binding.displayInReports) {
                columns.push(field.id)
            }
        }
        defaultEventColumnsByStage.set(stage.id, columns)
    }

    const fieldsByProgramStage = new Map<string, FieldCatalog>()
    for (const stage of parsedProgram.programStages) {
        if (stage.access?.read === false) {
            continue
        }
        const stageFields = new Map(fields)
        const stageAssignedUser = stageFields.get('assignedUser')
        const occurredAt = stageFields.get('eventOccurredAt')
        const scheduledAt = stageFields.get('eventScheduledAt')
        const eventAssignedUser = stageFields.get('eventAssignedUser')
        if (stageAssignedUser) {
            stageFields.set(stageAssignedUser.id, {
                ...stageAssignedUser,
                filterable: false,
            })
        }
        if (occurredAt) {
            stageFields.set(
                occurredAt.id,
                withMetadataLabel(occurredAt, stage.displayExecutionDateLabel)
            )
        }
        if (scheduledAt) {
            stageFields.set(scheduledAt.id, {
                ...withMetadataLabel(scheduledAt, stage.displayDueDateLabel),
                filterable: stage.hideDueDate === false,
                columnable: stage.hideDueDate === false,
            })
        }
        if (eventAssignedUser) {
            stageFields.set(eventAssignedUser.id, {
                ...eventAssignedUser,
                filterable: stage.enableUserAssignment === true,
                columnable: stage.enableUserAssignment === true,
            })
        }
        fieldsByProgramStage.set(stage.id, stageFields)
    }

    return {
        fields,
        fieldsByProgramStage,
        capabilities,
        defaultTrackedEntityColumns,
        defaultEventColumnsByStage,
        readableProgramStageIds,
    }
}
