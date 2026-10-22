import { Button } from '@/components/dhis2/ui/button'
import {
    Table,
    TableBody,
    TableCell,
    TableCellHead,
    TableHead,
    TableRow,
    TableRowHead,
} from '@dhis2/ui'
import React from 'react'
import type { NormalizedSavedWorkingList } from '../../../../api/savedLists'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dhis2/ui/dialog'
import type { WorkingListConfiguration } from '../../../../domain/model'
import type {
    StaleReferenceIssue,
    StaleReferenceRepairDecision,
} from '../../../../domain/staleReferences'
import {
    useWorkingListText,
    type WorkingListTranslate,
} from '../../../WorkingListText'

interface WorkingListRepairPreview {
    decisions: StaleReferenceRepairDecision[]
    removedFilters: number
    removedColumns: number
    replacedColumns: number
    replacedSort: boolean
}

const filterPath = /^(filters|attributeValueFilters|dataFilters)\./
const columnPath = /^(columns|displayColumnOrder)\./

const referenceDetails = (
    list: Extract<
        NormalizedSavedWorkingList,
        { compatibility: 'incompatible' }
    >,
    issue: StaleReferenceIssue,
    translate: WorkingListTranslate
) => {
    const filterIndex = issue.path.match(/^filters\.(\d+)\./)?.[1]
    const savedField =
        filterIndex == null
            ? undefined
            : list.candidateConfiguration?.filters[Number(filterIndex)]?.field
    if (
        issue.path.startsWith('attributeValueFilters.') ||
        savedField?.source === 'trackedEntityAttribute'
    ) {
        return {
            id: issue.referenceId,
            kind: translate('Tracked entity attribute'),
        }
    }
    if (
        issue.path.startsWith('dataFilters.') ||
        savedField?.source === 'eventDataElement'
    ) {
        return {
            id: issue.referenceId,
            kind: translate('Data element'),
        }
    }
    if (savedField?.source === 'system') {
        return {
            id: issue.referenceId,
            kind: translate('System field'),
        }
    }
    if (
        columnPath.test(issue.path) ||
        issue.path === 'sort.fieldId' ||
        issue.path === 'order'
    ) {
        return { id: issue.referenceId, kind: translate('Unknown') }
    }
    return { id: issue.referenceId, kind: translate('Unknown') }
}

const repairAction = (
    decision: StaleReferenceRepairDecision,
    translate: WorkingListTranslate
) => {
    if (decision.action === 'remove' && filterPath.test(decision.path)) {
        return translate('Remove')
    }
    if (decision.action === 'remove' && columnPath.test(decision.path)) {
        return translate('Remove')
    }
    if (decision.action === 'replaceColumn') {
        return translate('Replace with default')
    }
    if (decision.action === 'replaceSort') {
        return translate('Replace with default')
    }
    if (decision.action === 'replaceFilter') {
        return translate('Replace with {{replacement}}', {
            replacement: decision.filter.field.id,
        })
    }
    return translate('Remove')
}

interface WorkingListRepairDialogProps {
    open: boolean
    list?: NormalizedSavedWorkingList
    preview?: WorkingListRepairPreview
    repairedConfiguration?: WorkingListConfiguration
    canRepair: boolean
    onClose: () => void
    onRepair: (
        list: NormalizedSavedWorkingList,
        configuration: WorkingListConfiguration
    ) => void
}

export const WorkingListRepairDialog = ({
    open,
    list,
    preview,
    repairedConfiguration,
    canRepair,
    onClose,
    onRepair,
}: WorkingListRepairDialogProps) => {
    const i18n = { t: useWorkingListText() }

    if (
        !open ||
        list?.compatibility !== 'incompatible' ||
        !preview ||
        !repairedConfiguration
    ) {
        return null
    }

    const issueByPath = new Map(list.issues.map((issue) => [issue.path, issue]))
    const details = preview.decisions.flatMap((decision) => {
        const issue = issueByPath.get(decision.path)
        if (!issue) {
            return []
        }
        const { id, kind } = referenceDetails(list, issue, i18n.t)
        return [
            {
                path: decision.path,
                id,
                kind,
                action: repairAction(decision, i18n.t),
            },
        ]
    })
    return (
        <Dialog
            open
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    onClose()
                }
            }}
        >
            <DialogContent
                position="middle"
                data-test="repair-working-list-dialog"
                closeLabel={i18n.t('Close')}
            >
                <DialogHeader>
                    <DialogTitle>
                        {i18n.t('Repair this saved list?')}
                    </DialogTitle>
                </DialogHeader>
                <div className="min-h-0 flex-1 overflow-y-auto text-[14px]">
                    <p className="m-0 text-[var(--colors-grey700)]">
                        {i18n.t(
                            'Some metadata changed, was removed, or is no longer accessible.'
                        )}
                    </p>
                    <div
                        className="[margin:16px_0]"
                        data-testid="repair-working-list-preview"
                    >
                        <Table suppressZebraStriping>
                            <TableHead>
                                <TableRowHead>
                                    <TableCellHead dense>
                                        {i18n.t('Reference')}
                                    </TableCellHead>
                                    <TableCellHead dense>
                                        {i18n.t('Proposed repair')}
                                    </TableCellHead>
                                </TableRowHead>
                            </TableHead>
                            <TableBody>
                                {details.map(({ path, id, kind, action }) => (
                                    <TableRow key={path} suppressZebraStriping>
                                        <TableCell dense>
                                            {id} ({kind})
                                        </TableCell>
                                        <TableCell dense>{action}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        data-test="repair-working-list-cancel"
                        onClick={onClose}
                    >
                        {i18n.t('Cancel')}
                    </Button>
                    <Button
                        data-test="repair-working-list-confirm"
                        disabled={!canRepair}
                        onClick={() => onRepair(list, repairedConfiguration)}
                    >
                        {i18n.t('Repair')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
