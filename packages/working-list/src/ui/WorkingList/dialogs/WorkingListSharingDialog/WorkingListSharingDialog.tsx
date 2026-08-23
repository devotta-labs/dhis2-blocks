import { NoticeBox, SharingDialog } from '@dhis2/ui'
import React from 'react'
import {
    getSharingType,
    type NormalizedSavedWorkingList,
} from '../../../../api/savedLists'
import { useWorkingListText } from '../../../WorkingListText'

interface WorkingListSharingDialogProps {
    list?: NormalizedSavedWorkingList
    error?: string
    onClose: () => void
    onError: (message: string) => void
    onSave: () => void
}

export const WorkingListSharingDialog = ({
    list,
    error,
    onClose,
    onError,
    onSave,
}: WorkingListSharingDialogProps) => {
    const i18n = { t: useWorkingListText() }

    return (
        <>
            {error && (
                <NoticeBox error title={i18n.t('Could not update sharing')}>
                    {error}
                </NoticeBox>
            )}
            {list && (
                <SharingDialog
                    id={list.id}
                    type={getSharingType(list.resource)}
                    metadataSharing
                    onClose={onClose}
                    onError={(sharingError) =>
                        onError(
                            sharingError instanceof Error
                                ? sharingError.message
                                : String(sharingError)
                        )
                    }
                    onSave={onSave}
                />
            )}
        </>
    )
}
