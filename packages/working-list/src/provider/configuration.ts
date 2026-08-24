import { Result } from 'better-result'
import type { ProgramFieldCatalog } from '../api/metadata'
import type {
    WorkingListConfiguration as InternalConfiguration,
    AppliedFilter as InternalFilter,
} from '../domain/model'
import { WorkingListConfigurationSchema } from '../domain/schemas'
import { validateConfigurationReferences } from '../domain/staleReferences'
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

export const internalConfigurationFingerprint = (
    configuration: InternalConfiguration
) =>
    JSON.stringify(
        canonicalizeValue(WorkingListConfigurationSchema.parse(configuration))
    )

export const shouldBeginControlledSelection = (
    previousId: string | undefined,
    nextId: string
) => previousId !== nextId

export const resolveSelectedSavedListId = (
    selectedSavedListId: string | null,
    defaultListId: string
) =>
    selectedSavedListId && selectedSavedListId.trim().length > 0
        ? selectedSavedListId
        : defaultListId

export const isCurrentSelection = (
    currentId: string | undefined,
    expectedId: string
) => currentId === expectedId

export const canCommitMutationBaseline = ({
    currentSelectedId,
    currentConfiguration,
    submittedSelectedId,
    submittedConfiguration,
}: {
    currentSelectedId: string | undefined
    currentConfiguration: WorkingListConfiguration | undefined
    submittedSelectedId: string
    submittedConfiguration: WorkingListConfiguration
}) =>
    currentSelectedId === submittedSelectedId &&
    currentConfiguration !== undefined &&
    publicConfigurationFingerprint(currentConfiguration) ===
        publicConfigurationFingerprint(submittedConfiguration)

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

const resolveFilter = (
    filter: AppliedFilter,
    metadata: ProgramFieldCatalog,
    serializationContext?: FilterSerializationContext
): Result<InternalFilter, ConfigurationCommandError> => {
    const field = metadata.fields.get(filter.fieldId)
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
    const filters: InternalFilter[] = []
    for (const filter of configuration.filters) {
        const resolved = resolveFilter(filter, metadata, serializationContext)
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
        fields: metadata.fields,
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
