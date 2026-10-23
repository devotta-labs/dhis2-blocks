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
    /**
     * Program terminology for the cascade warning: pass `data.labels`.
     * Defaults to "enrollments" / "events"
     */
    labels?: Pick<TrackedEntityProfileData['labels'], 'enrollments' | 'events'>
    /** Required: the host decides where to go once the entity is gone */
    onSuccess: () => void
}

/**
 * Confirms deleting the tracked entity with everything attached to it. On
 * success it removes the entity's queries without refetching them (a refetch
 * would 404; a profile still on screen keeps its last data until it unmounts
 * and is not refetched on window focus or reconnect meanwhile), then calls `onOpenChange(false)` and `onSuccess()`. Failures are
 * shown in the dialog, which stays open.
 */
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

    // `isPending` reaches the button a render late; two confirms inside that
    // window must not send two imports.
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
