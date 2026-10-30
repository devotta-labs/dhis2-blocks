import {
    fieldsForConfiguration,
    fieldsForProgramStage,
    type ProgramFieldCatalog,
} from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import { ProgramStageWorkingListSchema } from '../api/schemas'
import type { StaleReferenceRepairDecision } from '../domain/staleReferences'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'

export interface SavedListRepairPlan {
    decisions: StaleReferenceRepairDecision[]
    removedFilters: number
    removedColumns: number
    replacedColumns: number
    replacedSort: boolean
}

export const createSavedListRepairPlan = (
    list: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'incompatible' }
    >,
    metadata: ProgramFieldCatalog
): SavedListRepairPlan => {
    const candidate = list.candidateConfiguration
    const invalidColumnPaths = new Set(
        list.issues
            .filter(
                (issue) =>
                    issue.kind === 'missingColumn' ||
                    (issue.kind === 'programStageFieldMismatch' &&
                        issue.path.startsWith('columns.'))
            )
            .map((issue) => issue.path)
    )
    const validColumnCount = candidate
        ? candidate.columns.filter(
              (_column, index) => !invalidColumnPaths.has(`columns.${index}`)
          ).length
        : 0
    const rawProgramStageId =
        list.resource === 'programStageWorkingLists'
            ? ProgramStageWorkingListSchema.parse(list.raw).programStage.id
            : undefined
    const programStageId =
        candidate?.mode === 'event'
            ? candidate.programStageId
            : rawProgramStageId
    const defaults = programStageId
        ? (metadata.defaultEventColumnsByStage.get(programStageId) ?? [])
        : metadata.defaultTrackedEntityColumns
    const fields = candidate
        ? fieldsForConfiguration(metadata, candidate)
        : fieldsForProgramStage(metadata, rawProgramStageId)
    const fallbackColumn = defaults.find((id) => fields.has(id))
    let replacementColumnUsed = false
    const decisions: StaleReferenceRepairDecision[] = []

    for (const issue of list.issues) {
        const path = issue.path
        if (
            issue.kind === 'missingFilterField' ||
            issue.kind === 'fieldChanged' ||
            issue.kind === 'scopeMismatch' ||
            issue.kind === 'unsupportedFilter' ||
            (issue.kind === 'programStageFieldMismatch' &&
                path.startsWith('filters.')) ||
            path.startsWith('attributeValueFilters.') ||
            path.startsWith('dataFilters.')
        ) {
            decisions.push({ path, action: 'remove' })
            continue
        }
        if (
            issue.kind === 'missingColumn' ||
            (issue.kind === 'programStageFieldMismatch' &&
                path.startsWith('columns.')) ||
            path.startsWith('displayColumnOrder.')
        ) {
            if (
                validColumnCount === 0 &&
                !replacementColumnUsed &&
                fallbackColumn
            ) {
                decisions.push({
                    path,
                    action: 'replaceColumn',
                    fieldId: fallbackColumn,
                })
                replacementColumnUsed = true
            } else {
                decisions.push({ path, action: 'remove' })
            }
            continue
        }
        if (
            (issue.kind === 'missingSortField' ||
                issue.kind === 'programStageFieldMismatch') &&
            (path === 'sort.fieldId' || path === 'order')
        ) {
            const fieldId = fields.has(DEFAULT_WORKING_LIST_SORT.fieldId)
                ? DEFAULT_WORKING_LIST_SORT.fieldId
                : fallbackColumn
            if (fieldId) {
                decisions.push({
                    path,
                    action: 'replaceSort',
                    sort: {
                        fieldId,
                        direction: DEFAULT_WORKING_LIST_SORT.direction,
                    },
                })
            }
        }
    }

    return {
        decisions,
        removedFilters: decisions.filter(
            (decision) =>
                decision.action === 'remove' &&
                (decision.path.startsWith('filters.') ||
                    decision.path.startsWith('attributeValueFilters.') ||
                    decision.path.startsWith('dataFilters.'))
        ).length,
        removedColumns: decisions.filter(
            (decision) =>
                decision.action === 'remove' &&
                (decision.path.startsWith('columns.') ||
                    decision.path.startsWith('displayColumnOrder.'))
        ).length,
        replacedColumns: decisions.filter(
            (decision) => decision.action === 'replaceColumn'
        ).length,
        replacedSort: decisions.some(
            (decision) => decision.action === 'replaceSort'
        ),
    }
}
