import {
    fieldsForConfiguration,
    fieldsForProgramStage,
    type ProgramFieldCatalog,
} from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import { ProgramStageWorkingListSchema } from '../api/schemas'
import type { StaleReferenceRepairDecision } from '../domain/staleReferences'
import {
    formatRepairLocation,
    parseRepairLocation,
} from '../domain/repairLocation'
import { DEFAULT_WORKING_LIST_SORT } from '../query/serialize'

export interface SavedListRepairPlan {
    decisions: StaleReferenceRepairDecision[]
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
                        parseRepairLocation(issue.path)?.kind === 'column')
            )
            .map((issue) => issue.path)
    )
    const validColumnCount = candidate
        ? candidate.columns.filter(
              (_column, index) =>
                  !invalidColumnPaths.has(
                      formatRepairLocation({
                          kind: 'column',
                          collection: 'columns',
                          index,
                      })
                  )
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
        const location = parseRepairLocation(path)
        if (
            issue.kind === 'missingFilterField' ||
            issue.kind === 'fieldChanged' ||
            issue.kind === 'scopeMismatch' ||
            issue.kind === 'unsupportedFilter' ||
            (issue.kind === 'programStageFieldMismatch' &&
                location?.kind === 'filter') ||
            (location?.kind === 'filter' && location.collection !== 'filters')
        ) {
            decisions.push({ path, action: 'remove' })
            continue
        }
        if (
            issue.kind === 'missingColumn' ||
            (issue.kind === 'programStageFieldMismatch' &&
                location?.kind === 'column') ||
            (location?.kind === 'column' &&
                location.collection === 'displayColumnOrder')
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
            location?.kind === 'sort'
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

    return { decisions }
}
