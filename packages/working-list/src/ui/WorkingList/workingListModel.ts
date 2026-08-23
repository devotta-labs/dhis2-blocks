import type { ProgramFieldCatalog } from '../../api/metadata'
import {
    ProgramStageWorkingListSchema,
    TrackedEntityInstanceFilterSchema,
} from '../../api/schemas'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import type { TrackerProgram } from '../../api/schemas'
import type {
    WorkingListConfiguration,
    WorkingListField,
} from '../../domain/model'
import type { StaleReferenceRepairDecision } from '../../domain/staleReferences'
import type { WorkingListPage } from '../../query/fetchers'
import { DEFAULT_WORKING_LIST_SORT } from '../../query/serialize'
import type { SelectedWorkingListIdentity } from '../../store/workingListStore'
import type { WorkingListDisplayRow } from '../types'

export const listIdentity = (
    list: NormalizedSavedWorkingList,
    generated: boolean
): SelectedWorkingListIdentity => ({
    id: list.id,
    resource: generated ? 'generatedDefault' : list.resource,
})

export interface SavedListRepairDecisions {
    decisions: StaleReferenceRepairDecision[]
    removedFilters: number
    removedColumns: number
    replacedColumns: number
    replacedSort: boolean
}

export const createSavedListRepairDecisions = (
    list: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'incompatible' }
    >,
    metadata: ProgramFieldCatalog
): SavedListRepairDecisions => {
    const candidate = list.candidateConfiguration
    const issueByPath = new Map(list.issues.map((issue) => [issue.path, issue]))
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
    const rawColumns =
        list.resource === 'trackedEntityInstanceFilters'
            ? TrackedEntityInstanceFilterSchema.parse(list.raw)
                  .entityQueryCriteria?.displayColumnOrder
            : ProgramStageWorkingListSchema.parse(list.raw)
                  .programStageQueryCriteria?.displayColumnOrder
    const validColumnCount = candidate
        ? candidate.columns.filter(
              (_column, index) => !invalidColumnPaths.has(`columns.${index}`)
          ).length
        : Math.max((rawColumns?.length ?? 0) - invalidColumnPaths.size, 0)
    const rawProgramStageId =
        list.resource === 'programStageWorkingLists'
            ? ProgramStageWorkingListSchema.parse(list.raw).programStage.id
            : undefined
    const defaultColumns =
        candidate?.mode === 'event'
            ? (metadata.defaultEventColumnsByStage.get(
                  candidate.programStageId
              ) ?? [])
            : rawProgramStageId
              ? (metadata.defaultEventColumnsByStage.get(rawProgramStageId) ??
                [])
              : metadata.defaultTrackedEntityColumns
    const fallbackColumn = defaultColumns.find((fieldId) =>
        metadata.fields.has(fieldId)
    )
    let replacementColumnUsed = false
    const decisions: StaleReferenceRepairDecision[] = []

    for (const [path, issue] of issueByPath) {
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
            const fallbackSortField = metadata.fields.has(
                DEFAULT_WORKING_LIST_SORT.fieldId
            )
                ? DEFAULT_WORKING_LIST_SORT.fieldId
                : (fallbackColumn ?? candidate?.columns[0])
            if (fallbackSortField) {
                decisions.push({
                    path,
                    action: 'replaceSort',
                    sort: {
                        fieldId: fallbackSortField,
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

export const pageRows = (
    pageData: WorkingListPage | undefined
): WorkingListDisplayRow[] => {
    if (!pageData) {
        return []
    }
    if (pageData.mode === 'trackedEntity') {
        return pageData.records.map((record) => ({
            id: record.trackedEntity.trackedEntity,
            trackedEntityId: record.trackedEntity.trackedEntity,
            values: record.values,
            issues: record.issues,
        }))
    }
    return pageData.records.map((record) => ({
        id: record.event.event.event,
        eventId: record.event.event.event,
        trackedEntityId: record.event.event.trackedEntity,
        values: {
            ...record.trackedEntity?.values,
            ...record.event.values,
        },
        issues: [
            ...(record.trackedEntity?.issues ?? []),
            ...record.event.issues,
        ],
    }))
}

export const workingListTableFields = (
    fields: WorkingListField[],
    program: TrackerProgram,
    configuration: WorkingListConfiguration
) => {
    const currentStage =
        configuration.mode === 'event'
            ? program.programStages.find(
                  (stage) => stage.id === configuration.programStageId
              )
            : undefined
    const stageDataElementIds = new Set(
        currentStage?.programStageDataElements.map(
            (binding) => binding.dataElement.id
        ) ?? []
    )
    return fields.filter((field) => {
        if (field.source === 'trackedEntityAttribute') {
            return true
        }
        if (field.source === 'eventDataElement') {
            return (
                configuration.mode === 'event' &&
                stageDataElementIds.has(field.id)
            )
        }
        if (['createdAt', 'programOwnerId'].includes(field.id)) {
            return true
        }
        return (
            configuration.mode === 'event' &&
            [
                'eventStatus',
                'eventOccurredAt',
                'eventScheduledAt',
                'eventOrgUnit',
                'eventAssignedUser',
            ].includes(field.id)
        )
    })
}
