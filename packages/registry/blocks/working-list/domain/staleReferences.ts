import type {
    AppliedFilter,
    FieldCatalog,
    WorkingListConfiguration,
    WorkingListSort,
} from './model'
import { WorkingListConfigurationSchema } from './schemas'

export interface StaleReferenceIssue {
    kind:
        | 'programMismatch'
        | 'missingProgramStage'
        | 'missingFilterField'
        | 'missingColumn'
        | 'missingSortField'
        | 'scopeMismatch'
        | 'fieldChanged'
        | 'programStageFieldMismatch'
        | 'unsupportedFilter'
        | 'noVisibleColumns'
    referenceId: string
    path: string
    message: string
}

export type ReferenceValidationResult =
    | { compatible: true }
    | { compatible: false; issues: StaleReferenceIssue[] }

export class StaleWorkingListError extends Error {
    readonly issues: StaleReferenceIssue[]

    constructor(issues: StaleReferenceIssue[]) {
        super(issues.map((issue) => issue.message).join('; '))
        this.name = 'StaleWorkingListError'
        this.issues = issues
    }
}

export const validateConfigurationReferences = (
    configuration: WorkingListConfiguration,
    {
        expectedProgramId,
        fields,
        readableProgramStageIds,
    }: {
        expectedProgramId: string
        fields: FieldCatalog
        readableProgramStageIds: ReadonlySet<string>
    }
): ReferenceValidationResult => {
    const issues: StaleReferenceIssue[] = []
    if (configuration.programId !== expectedProgramId) {
        issues.push({
            kind: 'programMismatch',
            referenceId: configuration.programId,
            path: 'programId',
            message: `Saved list belongs to program ${configuration.programId}, not ${expectedProgramId}`,
        })
    }
    if (
        configuration.mode === 'event' &&
        !readableProgramStageIds.has(configuration.programStageId)
    ) {
        issues.push({
            kind: 'missingProgramStage',
            referenceId: configuration.programStageId,
            path: 'programStageId',
            message: `Program stage ${configuration.programStageId} no longer exists or is inaccessible`,
        })
    }
    configuration.filters.forEach((filter, index) => {
        const current = fields.get(filter.field.id)
        if (!current) {
            issues.push({
                kind: 'missingFilterField',
                referenceId: filter.field.id,
                path: `filters.${index}.field`,
                message: `Filter field ${filter.field.id} no longer exists`,
            })
            return
        }
        if (
            current.source !== filter.field.source ||
            current.valueType !== filter.field.valueType
        ) {
            issues.push({
                kind: 'fieldChanged',
                referenceId: filter.field.id,
                path: `filters.${index}.field`,
                message: `Filter field ${filter.field.id} changed type or source`,
            })
        }
        if (current.scope === 'event' && configuration.mode !== 'event') {
            issues.push({
                kind: 'scopeMismatch',
                referenceId: filter.field.id,
                path: `filters.${index}.field.scope`,
                message: `Event field ${filter.field.id} cannot be used in tracked-entity mode`,
            })
        }
        if (
            configuration.mode === 'event' &&
            current.source === 'eventDataElement' &&
            !current.programStageIds?.includes(configuration.programStageId)
        ) {
            issues.push({
                kind: 'programStageFieldMismatch',
                referenceId: filter.field.id,
                path: `filters.${index}.field`,
                message: `Event field ${filter.field.id} does not belong to stage ${configuration.programStageId}`,
            })
        }
    })
    configuration.columns.forEach((columnId, index) => {
        const field = fields.get(columnId)
        if (!field) {
            issues.push({
                kind: 'missingColumn',
                referenceId: columnId,
                path: `columns.${index}`,
                message: `Column ${columnId} no longer exists`,
            })
        } else if (field.columnable === false) {
            issues.push({
                kind: 'missingColumn',
                referenceId: columnId,
                path: `columns.${index}`,
                message: `Column ${columnId} is unavailable in this program stage`,
            })
        } else if (
            configuration.mode === 'event' &&
            field.source === 'eventDataElement' &&
            !field.programStageIds?.includes(configuration.programStageId)
        ) {
            issues.push({
                kind: 'programStageFieldMismatch',
                referenceId: columnId,
                path: `columns.${index}`,
                message: `Column ${columnId} does not belong to stage ${configuration.programStageId}`,
            })
        }
    })
    const sortField = fields.get(configuration.sort.fieldId)
    if (!sortField) {
        issues.push({
            kind: 'missingSortField',
            referenceId: configuration.sort.fieldId,
            path: 'sort.fieldId',
            message: `Sort field ${configuration.sort.fieldId} no longer exists`,
        })
    } else if (sortField.columnable === false) {
        issues.push({
            kind: 'missingSortField',
            referenceId: sortField.id,
            path: 'sort.fieldId',
            message: `Sort field ${sortField.id} is unavailable in this program stage`,
        })
    } else if (
        configuration.mode === 'event' &&
        sortField.source === 'eventDataElement' &&
        !sortField.programStageIds?.includes(configuration.programStageId)
    ) {
        issues.push({
            kind: 'programStageFieldMismatch',
            referenceId: sortField.id,
            path: 'sort.fieldId',
            message: `Sort field ${sortField.id} does not belong to stage ${configuration.programStageId}`,
        })
    }
    return issues.length ? { compatible: false, issues } : { compatible: true }
}

export type StaleReferenceRepairDecision =
    | { path: string; action: 'remove' }
    | { path: string; action: 'replaceFilter'; filter: AppliedFilter }
    | { path: string; action: 'replaceColumn'; fieldId: string }
    | { path: string; action: 'replaceSort'; sort: WorkingListSort }

export type StaleReferenceRepairResult =
    | { status: 'repaired'; configuration: WorkingListConfiguration }
    | { status: 'blocked'; issues: StaleReferenceIssue[] }

/**
 * Applies only explicit repair choices. Program and stage mismatches remain
 * blocking because changing either changes the meaning and endpoint of a list.
 */
export const repairConfigurationReferences = ({
    configuration,
    issues,
    decisions,
    metadata,
}: {
    configuration: WorkingListConfiguration
    issues: StaleReferenceIssue[]
    decisions: StaleReferenceRepairDecision[]
    metadata: Parameters<typeof validateConfigurationReferences>[1]
}): StaleReferenceRepairResult => {
    const decisionsByPath = new Map(
        decisions.map((decision) => [decision.path, decision])
    )
    if (decisionsByPath.size !== decisions.length) {
        throw new Error('A repair plan cannot contain duplicate paths')
    }
    const blocking = issues.filter(
        (issue) =>
            issue.kind === 'programMismatch' ||
            issue.kind === 'missingProgramStage' ||
            !decisionsByPath.has(issue.path)
    )
    if (blocking.length) {
        return { status: 'blocked', issues: blocking }
    }

    const candidate = {
        ...configuration,
        filters: [...configuration.filters],
        columns: [...configuration.columns],
        sort: { ...configuration.sort },
    }
    const invalidDecisions: StaleReferenceIssue[] = []
    const removedFilterIndexes = new Set<number>()
    const removedColumnIndexes = new Set<number>()

    for (const issue of issues) {
        const decision = decisionsByPath.get(issue.path)
        if (!decision) {
            continue
        }
        if (
            issue.kind === 'missingFilterField' ||
            issue.kind === 'fieldChanged' ||
            issue.kind === 'scopeMismatch' ||
            issue.kind === 'unsupportedFilter' ||
            (issue.kind === 'programStageFieldMismatch' &&
                issue.path.startsWith('filters.'))
        ) {
            const match = issue.path.match(/^filters\.(\d+)\./)
            const index = match ? Number(match[1]) : -1
            if (index < 0 || index >= candidate.filters.length) {
                invalidDecisions.push(issue)
                continue
            }
            if (decision.action === 'remove') {
                removedFilterIndexes.add(index)
            } else if (decision.action === 'replaceFilter') {
                candidate.filters[index] = decision.filter
            } else {
                invalidDecisions.push(issue)
            }
            continue
        }
        if (
            issue.kind === 'missingColumn' ||
            (issue.kind === 'programStageFieldMismatch' &&
                issue.path.startsWith('columns.'))
        ) {
            const match = issue.path.match(/^columns\.(\d+)$/)
            const index = match ? Number(match[1]) : -1
            if (index < 0 || index >= candidate.columns.length) {
                invalidDecisions.push(issue)
                continue
            }
            if (decision.action === 'remove') {
                removedColumnIndexes.add(index)
            } else if (decision.action === 'replaceColumn') {
                candidate.columns[index] = decision.fieldId
            } else {
                invalidDecisions.push(issue)
            }
            continue
        }
        if (
            (issue.kind === 'missingSortField' ||
                issue.kind === 'programStageFieldMismatch') &&
            issue.path === 'sort.fieldId' &&
            decision.action === 'replaceSort'
        ) {
            candidate.sort = decision.sort
            continue
        }
        invalidDecisions.push(issue)
    }

    if (invalidDecisions.length) {
        return { status: 'blocked', issues: invalidDecisions }
    }
    candidate.filters = candidate.filters.filter(
        (_filter, index) => !removedFilterIndexes.has(index)
    )
    candidate.columns = candidate.columns.filter(
        (_column, index) => !removedColumnIndexes.has(index)
    )
    if (!candidate.columns.length) {
        return {
            status: 'blocked',
            issues: [
                {
                    kind: 'noVisibleColumns',
                    referenceId: '',
                    path: 'columns',
                    message:
                        'A working list requires at least one visible column',
                },
            ],
        }
    }
    const parsedResult = WorkingListConfigurationSchema.safeParse(candidate)
    if (!parsedResult.success) {
        return {
            status: 'blocked',
            issues: [
                {
                    kind: 'unsupportedFilter',
                    referenceId: '',
                    path: 'configuration',
                    message: parsedResult.error.issues
                        .map((issue) => issue.message)
                        .join('; '),
                },
            ],
        }
    }
    const parsed = {
        ...parsedResult.data,
        filters: parsedResult.data.filters.map((filter) => ({
            ...filter,
            field: metadata.fields.get(filter.field.id) ?? filter.field,
        })),
    }
    const validation = validateConfigurationReferences(parsed, metadata)
    if ('issues' in validation) {
        return { status: 'blocked', issues: validation.issues }
    }
    return { status: 'repaired', configuration: parsed }
}
