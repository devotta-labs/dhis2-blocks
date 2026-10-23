import i18n from '@dhis2/d2-i18n'
import React, { useRef, useState } from 'react'
import type {
    ControlledDialogProps,
    ProfileMutationError,
    ProfileTrackedEntity,
    TrackedEntityProfileData,
} from '../types'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { useDeleteTrackedEntity } from './useDeleteTrackedEntity'

export type ProfileWidgetDeleteDialogProps = ControlledDialogProps & {
    trackedEntity: ProfileTrackedEntity
    labels?: Pick<TrackedEntityProfileData['labels'], 'enrollments' | 'events'>
    onSuccess: () => void
}

export function ProfileWidgetDeleteDialog({
    open,
    onOpenChange,
    trackedEntity,
    labels,
    onSuccess,
}: ProfileWidgetDeleteDialogProps) {
    const { deleteTrackedEntity, isPending } = useDeleteTrackedEntity()
    const [error, setError] = useState<ProfileMutationError | null>(null)
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) setError(null)
    }

    const trackedEntityTypeName = trackedEntity.trackedEntityTypeName
    const interpolation = {
        trackedEntityTypeName,
        interpolation: { escapeValue: false },
    }

    const inFlight = useRef(false)
    const handleConfirm = async () => {
        if (inFlight.current) return
        inFlight.current = true
        try {
            setError(null)
            const result = await deleteTrackedEntity(trackedEntity.id)
            if (result.isErr()) {
                setError(result.error)
                return
            }
            onOpenChange(false)
            onSuccess()
        } finally {
            inFlight.current = false
        }
    }

    return (
        <ConfirmActionDialog
            open={open}
            onOpenChange={onOpenChange}
            slot="profile-widget-delete-dialog"
            size="default"
            title={i18n.t('Delete {{trackedEntityTypeName}}', interpolation)}
            description={i18n.t(
                'Are you sure you want to delete this {{trackedEntityTypeName}}? This will permanently remove the {{trackedEntityTypeName}} and all its associated {{enrollmentsLabel}} and {{eventsLabel}} in all programs.',
                {
                    trackedEntityTypeName,
                    enrollmentsLabel:
                        labels?.enrollments || i18n.t('enrollments'),
                    eventsLabel: labels?.events || i18n.t('events'),
                    interpolation: { escapeValue: false },
                }
            )}
            confirmLabel={i18n.t(
                'Yes, delete {{trackedEntityTypeName}}',
                interpolation
            )}
            confirmVariant="destructive"
            errorTitle={i18n.t(
                'There was a problem deleting the {{trackedEntityTypeName}}',
                interpolation
            )}
            error={error}
            isPending={isPending}
            onConfirm={() => {
                void handleConfirm()
            }}
        />
    )
}
