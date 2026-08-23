import {
    Button,
    Modal,
    ModalActions,
    ModalContent,
    ModalTitle,
} from '@dhis2/ui'
import React from 'react'
import type { NormalizedSavedWorkingList } from '../../../../api/savedLists'
import type { WorkingListConfiguration } from '../../../../domain/model'
import layoutStyles from '../../../styles/layout.module.css'
import { useWorkingListText } from '../../../WorkingListText'

interface WorkingListRepairPreview {
    removedFilters: number
    removedColumns: number
    replacedColumns: number
    replacedSort: boolean
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

    return (
        <Modal
            small
            position="middle"
            dataTest="repair-working-list-dialog"
            onClose={onClose}
        >
            <ModalTitle>{i18n.t('Repair saved working list?')}</ModalTitle>
            <ModalContent>
                <p>
                    {i18n.t(
                        'No records will be queried until you confirm. The repair keeps every available setting and updates this saved list in place.'
                    )}
                </p>
                <ul data-testid="repair-working-list-preview">
                    {preview.removedFilters > 0 && (
                        <li>
                            {i18n.t('Remove {{count}} unavailable filters', {
                                count: preview.removedFilters,
                            })}
                        </li>
                    )}
                    {preview.removedColumns > 0 && (
                        <li>
                            {i18n.t('Remove {{count}} unavailable columns', {
                                count: preview.removedColumns,
                            })}
                        </li>
                    )}
                    {preview.replacedColumns > 0 && (
                        <li>
                            {i18n.t(
                                'Replace {{count}} unavailable columns with program defaults',
                                { count: preview.replacedColumns }
                            )}
                        </li>
                    )}
                    {preview.replacedSort && (
                        <li>
                            {i18n.t(
                                'Replace the unavailable sort with the default sort'
                            )}
                        </li>
                    )}
                </ul>
            </ModalContent>
            <ModalActions>
                <div className={layoutStyles['modal-button-strip']}>
                    <Button
                        dataTest="repair-working-list-cancel"
                        onClick={onClose}
                    >
                        {i18n.t('Cancel')}
                    </Button>
                    <Button
                        primary
                        dataTest="repair-working-list-confirm"
                        disabled={!canRepair}
                        onClick={() => onRepair(list, repairedConfiguration)}
                    >
                        {i18n.t('Repair and update list')}
                    </Button>
                </div>
            </ModalActions>
        </Modal>
    )
}
