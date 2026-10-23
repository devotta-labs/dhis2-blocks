import i18n from '@dhis2/d2-i18n'
import React, { useRef, useState } from 'react'
import type {
    ControlledDialogProps,
    ProfileMutationError,
    ProfileTrackedEntity,
} from '../types'
import { ConfirmActionDialog } from './ConfirmActionDialog'
import { useSetTrackedEntityInactive } from './useSetTrackedEntityInactive'

export type ProfileWidgetStatusDialogProps = ControlledDialogProps & {
    trackedEntity: ProfileTrackedEntity
    onSuccess?: (inactive: boolean) => void
}

/**
 * Confirms deactivating or activating, depending on `trackedEntity.inactive`.
 * On success it invalidates the profile and changelog queries, calls
 * `onOpenChange(false)` and then `onSuccess(nextInactive)`. Failures are shown
 * in the dialog, which stays open.
 */
export function ProfileWidgetStatusDialog({
    open,
    onOpenChange,
    trackedEntity,
    onSuccess,
}: ProfileWidgetStatusDialogProps) {
    const { setInactive, isPending } = useSetTrackedEntityInactive()
    const [error, setError] = useState<ProfileMutationError | null>(null)
    /*
     * The status the confirmation was made from. It keeps the copy stable
     * while the refetched profile flips `trackedEntity.inactive` under the
     * pending or closing dialog.
     */
    const [confirmedFrom, setConfirmedFrom] = useState<boolean | null>(null)
    const [wasOpen, setWasOpen] = useState(open)
    if (open !== wasOpen) {
        setWasOpen(open)
        if (open) {
            setError(null)
            setConfirmedFrom(null)
        }
    }

    const inactive = confirmedFrom ?? trackedEntity.inactive
    const interpolation = {
        trackedEntityTypeName: trackedEntity.trackedEntityTypeName,
        interpolation: { escapeValue: false },
    }

    // `isPending` reaches the button a render late; two confirms inside that
    // window must not send two imports.
    const inFlight = useRef(false)
    const handleConfirm = async () => {
        if (inFlight.current) return
        inFlight.current = true
        try {
            const nextInactive = !inactive
            setError(null)
            setConfirmedFrom(inactive)
            const result = await setInactive({
                trackedEntityId: trackedEntity.id,
                inactive: nextInactive,
            })
            if (result.isErr()) {
                setError(result.error)
                setConfirmedFrom(null)
                return
            }
            onOpenChange(false)
            onSuccess?.(nextInactive)
        } finally {
            inFlight.current = false
        }
    }

    return (
        <ConfirmActionDialog
            open={open}
            onOpenChange={onOpenChange}
            slot="profile-widget-status-dialog"
            size="sm"
            title={
                inactive
                    ? i18n.t(
                          'Activate {{trackedEntityTypeName}}',
                          interpolation
                      )
                    : i18n.t(
                          'Deactivate {{trackedEntityTypeName}}',
                          interpolation
                      )
            }
            description={
                inactive
                    ? i18n.t(
                          'Are you sure you want to activate this {{trackedEntityTypeName}}? This will change its status to active and write operations will be allowed.',
                          interpolation
                      )
                    : i18n.t(
                          'Are you sure you want to deactivate this {{trackedEntityTypeName}}? This will change its status to inactive and only read operations will be allowed.',
                          interpolation
                      )
            }
            confirmLabel={
                inactive
                    ? i18n.t(
                          'Yes, activate {{trackedEntityTypeName}}',
                          interpolation
                      )
                    : i18n.t(
                          'Yes, deactivate {{trackedEntityTypeName}}',
                          interpolation
                      )
            }
            confirmVariant={inactive ? 'default' : 'destructive'}
            errorTitle={
                inactive
                    ? i18n.t(
                          'There was a problem activating the {{trackedEntityTypeName}}',
                          interpolation
                      )
                    : i18n.t(
                          'There was a problem deactivating the {{trackedEntityTypeName}}',
                          interpolation
                      )
            }
            error={error}
            isPending={isPending}
            onConfirm={() => {
                void handleConfirm()
            }}
        />
    )
}
