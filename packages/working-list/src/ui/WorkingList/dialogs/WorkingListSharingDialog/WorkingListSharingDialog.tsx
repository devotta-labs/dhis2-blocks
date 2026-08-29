import { NoticeBox, SharingDialog } from '@dhis2/ui'
import React, { type ComponentProps, type ComponentType } from 'react'
import {
    getSharingType,
    type NormalizedSavedWorkingList,
} from '../../../../api/savedLists'
import { useWorkingListText } from '../../../WorkingListText'

type SharingDialogCompatProps = Omit<
    ComponentProps<typeof SharingDialog>,
    'type'
> & {
    type: ReturnType<typeof getSharingType>
}

// SAFETY: DHIS2 accepts trackedEntityInstanceFilter as the sharing API resource
// type; @dhis2/ui 10.17 has not added that value to its narrower prop type yet.
const SharingDialogCompat =
    SharingDialog as ComponentType<SharingDialogCompatProps>

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
                <SharingDialogCompat
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
