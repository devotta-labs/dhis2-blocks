import i18n from '@dhis2/d2-i18n'
import {
    IconBlock16,
    IconCheckmarkCircle16,
    IconClockHistory16,
    IconDelete16,
} from '@dhis2/ui-icons'
import { useState } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    ProfileWidget,
    ProfileWidgetChangelogDialog,
    ProfileWidgetContent,
    ProfileWidgetDeleteDialog,
    ProfileWidgetField,
    ProfileWidgetFieldList,
    ProfileWidgetHeader,
    ProfileWidgetHeaderActions,
    ProfileWidgetMenu,
    ProfileWidgetMenuItem,
    ProfileWidgetStatusDialog,
    ProfileWidgetTitle,
    ProfileWidgetToggle,
    ProfileWidgetValue,
    useTrackedEntityProfile,
    type TrackedEntityProfileData,
    type UseTrackedEntityProfileResult,
} from '@/components/profile-widget'

/**
 * The Capture-style profile widget on an enrollment dashboard.
 *
 * `mXAzn3hMR5a` (Sarah Thompson) is enrolled in `uy2gU8kT1jF`
 * (MNCH / PNC (Adult Woman)) at Ngelehun CHC in the DHIS2 Sierra Leone demo
 * database. Replace them with a tracked entity and a program it is enrolled
 * in on your own instance.
 */
const TRACKED_ENTITY_ID = 'mXAzn3hMR5a'
const PROGRAM_ID = 'uy2gU8kT1jF'

type ProfileDialog = 'changelog' | 'status' | 'delete' | null

/** Capture's loading, error and empty states, then one row per field. */
function ProfileBody({ profile }: { profile: UseTrackedEntityProfileResult }) {
    const { data, error, isPending, refetch } = profile

    if (isPending) {
        return (
            <Spinner
                className="size-6 border-4"
                aria-label={i18n.t('Loading profile')}
            />
        )
    }

    if (error || !data) {
        return (
            <ErrorAlert
                title={i18n.t(
                    'Profile widget could not be loaded. Please try again later'
                )}
            >
                <Button variant="secondary" size="sm" onClick={refetch}>
                    {i18n.t('Retry')}
                </Button>
            </ErrorAlert>
        )
    }

    const { attributes, fields, labels, trackedEntity } = data

    if (fields.length === 0) {
        // Capture's empty-state copy and colour (grey600).
        const attributesLabel = labels.attributes
        const { trackedEntityTypeName } = trackedEntity
        const interpolation = { escapeValue: false }

        return (
            <p className="m-0 text-sm text-dhis2-grey-600">
                {attributes.length === 0
                    ? trackedEntityTypeName
                        ? i18n.t(
                              'No {{attributesLabel}} configured for {{trackedEntityTypeName}}',
                              {
                                  attributesLabel,
                                  trackedEntityTypeName,
                                  interpolation,
                              }
                          )
                        : i18n.t('No {{attributesLabel}} configured', {
                              attributesLabel,
                              interpolation,
                          })
                    : i18n.t('No {{attributesLabel}} configured to display', {
                          attributesLabel,
                          interpolation,
                      })}
            </p>
        )
    }

    return (
        <ProfileWidgetFieldList>
            {fields.map((field) => (
                <ProfileWidgetField key={field.id} label={field.label}>
                    <ProfileWidgetValue value={field.value} />
                </ProfileWidgetField>
            ))}
        </ProfileWidgetFieldList>
    )
}

/** Capture's menu order, each item gated on `data.permissions`. */
function ProfileActionsMenu({
    data,
    onOpenDialog,
}: {
    data: TrackedEntityProfileData
    onOpenDialog: (dialog: Exclude<ProfileDialog, null>) => void
}) {
    const { permissions, trackedEntity } = data
    const deletePermission = permissions.delete
    const trackedEntityTypeName = trackedEntity.trackedEntityTypeName

    // Capture hides the whole menu when no item would show.
    if (
        permissions.changelog.status === 'unavailable' &&
        permissions.setInactive.status === 'unavailable' &&
        deletePermission.status === 'unavailable'
    ) {
        return null
    }

    return (
        <ProfileWidgetMenu>
            {permissions.changelog.status === 'available' && (
                <ProfileWidgetMenuItem
                    onClick={() => onOpenDialog('changelog')}
                >
                    <IconClockHistory16 />
                    {i18n.t('View changelog')}
                </ProfileWidgetMenuItem>
            )}
            {permissions.setInactive.status === 'available' && (
                <ProfileWidgetMenuItem
                    destructive={!trackedEntity.inactive}
                    onClick={() => onOpenDialog('status')}
                >
                    {trackedEntity.inactive ? (
                        <IconCheckmarkCircle16 />
                    ) : (
                        <IconBlock16 />
                    )}
                    {trackedEntity.inactive
                        ? i18n.t('Activate {{trackedEntityTypeName}}', {
                              trackedEntityTypeName,
                              interpolation: { escapeValue: false },
                          })
                        : i18n.t('Deactivate {{trackedEntityTypeName}}', {
                              trackedEntityTypeName,
                              interpolation: { escapeValue: false },
                          })}
                </ProfileWidgetMenuItem>
            )}
            {deletePermission.status !== 'unavailable' && (
                <ProfileWidgetMenuItem
                    destructive
                    disabled={deletePermission.status === 'disabled'}
                    disabledReason={
                        deletePermission.status === 'disabled'
                            ? deletePermission.reason
                            : undefined
                    }
                    onClick={() => onOpenDialog('delete')}
                >
                    <IconDelete16 />
                    {i18n.t('Delete {{trackedEntityTypeName}}', {
                        trackedEntityTypeName,
                        interpolation: { escapeValue: false },
                    })}
                </ProfileWidgetMenuItem>
            )}
        </ProfileWidgetMenu>
    )
}

const ProfileWidgetEnrollment = () => {
    const profile = useTrackedEntityProfile({
        trackedEntityId: TRACKED_ENTITY_ID,
        programId: PROGRAM_ID,
    })
    const { data } = profile
    const [dialog, setDialog] = useState<ProfileDialog>(null)
    const [deleted, setDeleted] = useState(false)
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setDialog(null)
        }
    }

    // In an app, navigate away in the delete dialog's onSuccess instead,
    // e.g. back to the working list. The record no longer exists.
    if (deleted) {
        return (
            <p className="m-0 text-sm text-dhis2-grey-700">
                {i18n.t('The tracked entity was deleted.')}
            </p>
        )
    }

    return (
        <>
            <ProfileWidget className="max-w-md">
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>
                        {data?.title ?? i18n.t('Profile')}
                    </ProfileWidgetTitle>
                    <ProfileWidgetHeaderActions>
                        {data && (
                            <ProfileActionsMenu
                                data={data}
                                onOpenDialog={setDialog}
                            />
                        )}
                        <ProfileWidgetToggle />
                    </ProfileWidgetHeaderActions>
                </ProfileWidgetHeader>
                <ProfileWidgetContent>
                    <ProfileBody profile={profile} />
                </ProfileWidgetContent>
            </ProfileWidget>

            {data && (
                <>
                    <ProfileWidgetChangelogDialog
                        open={dialog === 'changelog'}
                        onOpenChange={handleDialogOpenChange}
                        trackedEntityId={data.trackedEntity.id}
                        programId={PROGRAM_ID}
                        attributes={data.attributes}
                    />
                    <ProfileWidgetStatusDialog
                        open={dialog === 'status'}
                        onOpenChange={handleDialogOpenChange}
                        trackedEntity={data.trackedEntity}
                    />
                    <ProfileWidgetDeleteDialog
                        open={dialog === 'delete'}
                        onOpenChange={handleDialogOpenChange}
                        trackedEntity={data.trackedEntity}
                        labels={data.labels}
                        onSuccess={() => setDeleted(true)}
                    />
                </>
            )}
        </>
    )
}

export default ProfileWidgetEnrollment
