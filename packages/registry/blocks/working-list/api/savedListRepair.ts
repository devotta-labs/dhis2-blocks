import type { FieldCatalog, WorkingListConfiguration } from '../domain/model'
import { repairConfigurationReferences } from '../domain/staleReferences'
import type {
    StaleReferenceIssue,
    StaleReferenceRepairDecision,
} from '../domain/staleReferences'
import {
    getValueTypeDefinition,
    validateAppliedFilter,
} from '../registry/valueTypes'
import type {
    FilterParsingContext,
    FilterSerializationContext,
} from '../registry/valueTypes'
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
    SavedValueFilter,
} from './schemas'
import type { NormalizedSavedWorkingList } from './savedListContracts'
import { normalizeSavedWorkingListResource } from './savedListNormalization'
import { buildSavedListPayload } from './savedListPayload'
import { replaceSavedFilter, unsupportedFilterIssues } from './savedFilterCodec'
import { parseRepairLocation } from '../domain/repairLocation'

export type SavedWorkingListRepairResult =
    | {
          status: 'repaired'
          configuration: WorkingListConfiguration
          payload: ReturnType<typeof buildSavedListPayload>
      }
    | { status: 'blocked'; issues: StaleReferenceIssue[] }

const cloneSavedResource = (
    list: Extract<NormalizedSavedWorkingList, { compatibility: 'incompatible' }>
) => {
    if (list.resource === 'trackedEntityInstanceFilters') {
        const raw = TrackedEntityInstanceFilterSchema.parse(list.raw)
        const criteria: EntityQueryCriteria = raw.entityQueryCriteria
            ? {
                  ...raw.entityQueryCriteria,
                  attributeValueFilters:
                      raw.entityQueryCriteria.attributeValueFilters?.map(
                          (filter) => ({ ...filter })
                      ),
                  displayColumnOrder: raw.entityQueryCriteria.displayColumnOrder
                      ? [...raw.entityQueryCriteria.displayColumnOrder]
                      : undefined,
              }
            : {}
        return {
            type: 'trackedEntityInstanceFilters' as const,
            criteria,
            raw: { ...raw, entityQueryCriteria: criteria },
        }
    }
    const raw = ProgramStageWorkingListSchema.parse(list.raw)
    const criteria: ProgramStageQueryCriteria = raw.programStageQueryCriteria
        ? {
              ...raw.programStageQueryCriteria,
              attributeValueFilters:
                  raw.programStageQueryCriteria.attributeValueFilters?.map(
                      (filter) => ({ ...filter })
                  ),
              dataFilters: raw.programStageQueryCriteria.dataFilters?.map(
                  (filter) => ({ ...filter })
              ),
              displayColumnOrder: raw.programStageQueryCriteria
                  .displayColumnOrder
                  ? [...raw.programStageQueryCriteria.displayColumnOrder]
                  : undefined,
          }
        : {}
    return {
        type: 'programStageWorkingLists' as const,
        criteria,
        raw: {
            ...raw,
            programStage: { ...raw.programStage },
            programStageQueryCriteria: criteria,
        },
    }
}

const repairRawFilter = ({
    savedFilter,
    decision,
    expectedSource,
    metadata,
    fields,
    serializationContext,
}: {
    savedFilter: SavedValueFilter
    decision: StaleReferenceRepairDecision
    expectedSource: 'trackedEntityAttribute' | 'eventDataElement'
    metadata: ProgramFieldCatalog
    fields: FieldCatalog
    serializationContext?: FilterSerializationContext
}): SavedValueFilter | undefined => {
    if (decision.action === 'remove') {
        return undefined
    }
    if (decision.action !== 'replaceFilter') {
        throw new Error('A stale saved filter requires remove or replaceFilter')
    }
    const currentField = fields.get(decision.filter.field.id)
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
    return replaceSavedFilter(savedFilter, {
        ...serialized,
        ...(expectedSource === 'trackedEntityAttribute'
            ? { attribute: currentField.id }
            : { dataItem: currentField.id }),
    })
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
        const candidateFields = fieldsForConfiguration(
            metadata,
            list.candidateConfiguration
        )
        const result = repairConfigurationReferences({
            configuration: list.candidateConfiguration,
            issues: list.issues,
            decisions,
            metadata: {
                expectedProgramId: programId,
                fields: candidateFields,
                readableProgramStageIds: metadata.readableProgramStageIds,
            },
        })
        if (result.status === 'blocked') {
            return result
        }
        const unsupported = unsupportedFilterIssues(
            result.configuration,
            metadata.capabilities
        )
        if (unsupported.length) {
            return { status: 'blocked', issues: unsupported }
        }
        const repairedFields = fieldsForConfiguration(
            metadata,
            result.configuration
        )
        return {
            status: 'repaired',
            configuration: result.configuration,
            payload: buildSavedListPayload({
                name: list.name,
                configuration: result.configuration,
                fields: repairedFields,
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

    const cloned = cloneSavedResource(list)
    const criteria = cloned.criteria
    const fields = fieldsForProgramStage(
        metadata,
        cloned.type === 'programStageWorkingLists'
            ? cloned.raw.programStage.id
            : undefined
    )

    for (const issue of list.issues) {
        const decision = decisionsByPath.get(issue.path)
        if (!decision) {
            return blockedRepair(issue)
        }
        const location = parseRepairLocation(issue.path)
        if (
            location?.kind === 'filter' &&
            location.collection === 'attributeValueFilters'
        ) {
            const index = location.index
            const filters = criteria.attributeValueFilters
            const savedFilter = filters?.[index]
            if (!savedFilter) {
                return blockedRepair(issue)
            }
            try {
                const repaired = repairRawFilter({
                    savedFilter,
                    decision,
                    expectedSource: 'trackedEntityAttribute',
                    metadata,
                    fields,
                    serializationContext,
                })
                if (repaired) {
                    filters[index] = repaired
                } else {
                    delete filters[index]
                }
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
        if (
            location?.kind === 'filter' &&
            location.collection === 'dataFilters' &&
            cloned.type === 'programStageWorkingLists'
        ) {
            const stageCriteria = cloned.criteria
            const index = location.index
            const filters = stageCriteria.dataFilters
            const savedFilter = filters?.[index]
            if (!savedFilter) {
                return blockedRepair(issue)
            }
            try {
                const repaired = repairRawFilter({
                    savedFilter,
                    decision,
                    expectedSource: 'eventDataElement',
                    metadata,
                    fields,
                    serializationContext,
                })
                if (repaired) {
                    filters[index] = repaired
                } else {
                    delete filters[index]
                }
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
        if (
            location?.kind === 'column' &&
            location.collection === 'displayColumnOrder' &&
            criteria.displayColumnOrder
        ) {
            const index = location.index
            if (decision.action === 'remove') {
                delete criteria.displayColumnOrder[index]
            } else if (decision.action === 'replaceColumn') {
                const field = fields.get(decision.fieldId)
                if (!field) {
                    return blockedRepair(issue)
                }
                criteria.displayColumnOrder[index] = field.apiName ?? field.id
            } else {
                return blockedRepair(issue)
            }
            continue
        }
        if (location?.kind === 'sort' && location.source === 'resource') {
            if (decision.action === 'remove') {
                criteria.order = undefined
            } else if (decision.action === 'replaceSort') {
                const field = fields.get(decision.sort.fieldId)
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
    if (cloned.type === 'programStageWorkingLists') {
        cloned.criteria.dataFilters =
            cloned.criteria.dataFilters?.filter(Boolean)
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
        resource: cloned.raw,
        type: list.resource,
        programId,
        metadata,
        parsingContext,
    })
    if (normalized.compatibility === 'incompatible') {
        return { status: 'blocked', issues: normalized.issues }
    }
    const normalizedFields = fieldsForConfiguration(
        metadata,
        normalized.configuration
    )
    return {
        status: 'repaired',
        configuration: normalized.configuration,
        payload: buildSavedListPayload({
            name: list.name,
            configuration: normalized.configuration,
            fields: normalizedFields,
            capabilities: metadata.capabilities,
            sharing: list.sharing,
            serializationContext,
            existingResource: cloned.raw,
        }),
    }
}
