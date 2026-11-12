import { Result } from 'better-result'
import {
    fieldsForConfiguration,
    type ProgramFieldCatalog,
} from '../api/metadata'
import type {
    FieldCatalog,
    WorkingListConfiguration as InternalConfiguration,
    AppliedFilter as InternalFilter,
} from '../domain/model'
import { WorkingListConfigurationSchema } from '../domain/schemas'
import { validateConfigurationReferences } from '../domain/staleReferences'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'
import { validateAppliedFilter } from '../registry/valueTypes'
import type { FilterSerializationContext } from '../registry/valueTypes'
import {
    canonicalizeValue,
    CanonicalValueSchema,
} from '../domain/canonicalValue'
import { InvalidConfigurationError, UnknownFieldError } from './errors'
import type { ConfigurationCommandError } from './errors'
import type { AppliedFilter, WorkingListConfiguration } from './contracts'

export const publicConfigurationFingerprint = (
    configuration: WorkingListConfiguration
) =>
    JSON.stringify(canonicalizeValue(CanonicalValueSchema.parse(configuration)))

export const resolveSelectedSavedListId = (
    selectedSavedListId: string | null,
    defaultListId: string
) =>
    selectedSavedListId && selectedSavedListId.trim().length > 0
        ? selectedSavedListId
        : defaultListId

export const toPublicConfiguration = (
    configuration: InternalConfiguration
): WorkingListConfiguration => {
    const base = {
        filters: configuration.filters.map(({ field, operator, value }) => ({
            fieldId: field.id,
            operator,
            value,
        })),
        columns: [...configuration.columns],
        sort: { ...configuration.sort },
    }
    return configuration.mode === 'event'
        ? {
              mode: 'event',
              programStageId: configuration.programStageId,
              ...base,
          }
        : { mode: 'trackedEntity', ...base }
}

/** `configuration` with `filter` in place of the field's earlier filter. */
export const withFilter = (
    configuration: WorkingListConfiguration,
    filter: AppliedFilter
): WorkingListConfiguration => ({
    ...configuration,
    filters: configuration.filters.some(
        (item) => item.fieldId === filter.fieldId
    )
        ? configuration.filters.map((item) =>
              item.fieldId === filter.fieldId ? filter : item
          )
        : [...configuration.filters, filter],
})

export const withoutFilter = (
    configuration: WorkingListConfiguration,
    fieldId: string
): WorkingListConfiguration => ({
    ...configuration,
    filters: configuration.filters.filter(
        (filter) => filter.fieldId !== fieldId
    ),
})

/**
 * `configuration` listing the events of `programStageId`, or tracked
 * entities again without one. Only tracked-entity filters carry over, and
 * the columns and sort start from the defaults: the old ones may name fields
 * the new list does not have.
 */
export const withProgramStage = (
    configuration: WorkingListConfiguration,
    metadata: ProgramFieldCatalog,
    programStageId: string | undefined
): WorkingListConfiguration => {
    const base = {
        filters: configuration.filters.filter((filter) => {
            const field = metadata.fields.get(filter.fieldId)
            return (
                field?.scope === 'trackedEntity' &&
                (!programStageId || field.id !== 'assignedUser')
            )
        }),
        columns: [
            ...((programStageId
                ? metadata.defaultEventColumnsByStage.get(programStageId)
                : undefined) ?? metadata.defaultTrackedEntityColumns),
        ],
        sort: { ...DEFAULT_WORKING_LIST_SORT },
    }
    return programStageId
        ? { mode: 'event', programStageId, ...base }
        : { mode: 'trackedEntity', ...base }
}

/** Whether two configurations ask the server for different rows. */
export const selectsDifferentRows = (
    left: WorkingListConfiguration,
    right: WorkingListConfiguration
) =>
    publicConfigurationFingerprint({ ...left, columns: [] }) !==
    publicConfigurationFingerprint({ ...right, columns: [] })

const resolveFilter = (
    filter: AppliedFilter,
    metadata: ProgramFieldCatalog,
    serializationContext?: FilterSerializationContext,
    fields: FieldCatalog = metadata.fields
): Result<InternalFilter, ConfigurationCommandError> => {
    const field = fields.get(filter.fieldId)
    if (!field) {
        return Result.err(
            new UnknownFieldError({
                fieldId: filter.fieldId,
                message: `Unknown working-list field ${filter.fieldId}`,
            })
        )
    }
    try {
        return Result.ok(
            validateAppliedFilter(
                { field, operator: filter.operator, value: filter.value },
                metadata.capabilities,
                serializationContext
            )
        )
    } catch (cause) {
        return Result.err(
            new InvalidConfigurationError({
                message:
                    cause instanceof Error
                        ? cause.message
                        : `Invalid filter for ${filter.fieldId}`,
            })
        )
    }
}

export const resolvePublicConfiguration = ({
    configuration,
    programId,
    metadata,
    serializationContext,
}: {
    configuration: WorkingListConfiguration
    programId: string
    metadata: ProgramFieldCatalog
    serializationContext?: FilterSerializationContext
}): Result<InternalConfiguration, ConfigurationCommandError> => {
    const fields = fieldsForConfiguration(metadata, configuration)
    const filters: InternalFilter[] = []
    for (const filter of configuration.filters) {
        const resolved = resolveFilter(
            filter,
            metadata,
            serializationContext,
            fields
        )
        if (resolved.isErr()) {
            return resolved
        }
        filters.push(resolved.value)
    }
    const candidate =
        configuration.mode === 'event'
            ? {
                  ...configuration,
                  programId,
                  filters,
              }
            : {
                  ...configuration,
                  programId,
                  filters,
              }
    const parsed = WorkingListConfigurationSchema.safeParse(candidate)
    if (!parsed.success) {
        return Result.err(
            new InvalidConfigurationError({
                message: parsed.error.issues
                    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                    .join('; '),
            })
        )
    }
    const references = validateConfigurationReferences(parsed.data, {
        expectedProgramId: programId,
        fields,
        readableProgramStageIds: metadata.readableProgramStageIds,
    })
    if (!references.compatible) {
        return Result.err(
            new InvalidConfigurationError({
                message: references.issues
                    .map((issue) => issue.message)
                    .join('; '),
            })
        )
    }
    return Result.ok(parsed.data)
}
