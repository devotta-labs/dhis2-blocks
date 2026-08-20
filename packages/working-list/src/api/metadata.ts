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
        'trackedEntityType[id,displayName]',
        'access',
        `programTrackedEntityAttributes[displayInList,mandatory,searchable${searchMetadataFields(apiVersion)},trackedEntityAttribute[id,displayName,displayFormName,valueType,unique,searchable${searchMetadataFields(apiVersion)},optionSet[id,displayName,options[id,code,displayName]]]]`,
        'programStages[id,displayName,hideDueDate,enableUserAssignment,access,programStageDataElements[displayInReports,compulsory,dataElement[id,displayName,displayFormName,valueType,optionSet[id,displayName,options[id,code,displayName]]]]]',
    ].join(',')

/** Latest projection retained for consumers that prebuild metadata queries. */
export const PROGRAM_METADATA_FIELDS = getProgramMetadataFields(
    Number.MAX_SAFE_INTEGER
)

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
    const operators: Record<
        string,
        WorkingListField['preferredSearchOperator']
    > = {
        LIKE: 'like',
        SW: 'startsWith',
        EW: 'endsWith',
        EQ: 'equals',
        RANGE: 'range',
        GE: 'greaterThanOrEqual',
        LE: 'lessThanOrEqual',
        NULL: 'empty',
        '!NULL': 'notEmpty',
    }
    return operator ? operators[operator] : undefined
}

export interface ProgramFieldCatalog {
    fields: FieldCatalog
    capabilities: WorkingListCapabilities
    defaultTrackedEntityColumns: string[]
    defaultEventColumnsByStage: ReadonlyMap<string, string[]>
    readableProgramStageIds: ReadonlySet<string>
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
            ...(binding.mandatory ? { required: true } : {}),
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
                ...(requiredInStageIds.length ? { requiredInStageIds } : {}),
            }
            fields.set(field.id, field)
            if (binding.displayInReports) {
                columns.push(field.id)
            }
        }
        defaultEventColumnsByStage.set(stage.id, columns)
    }

    return {
        fields,
        capabilities,
        defaultTrackedEntityColumns,
        defaultEventColumnsByStage,
        readableProgramStageIds,
    }
}
