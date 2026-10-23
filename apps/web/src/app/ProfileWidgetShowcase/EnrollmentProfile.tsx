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
import {
    IconBlock16,
    IconCheckmarkCircle16,
    IconClockHistory16,
    IconDelete16,
} from '@dhis2/ui'
import React, { useState } from 'react'
import i18n from '../../i18n'

export type ProfileDialog = 'changelog' | 'status' | 'delete' | null

/** Capture's loading, error, empty and list states for a profile result. */
export const ProfileBody = ({
    profile,
}: {
    profile: UseTrackedEntityProfileResult
}) => {
    const { data, error, isPending, refetch } = profile

    if (isPending) {
        return (
            <Spinner
                className="size-6 border-4"
                role="status"
                aria-label={i18n.t('Loading profile')}
            />
        )
    }

    if (error || !data) {
        return (
            <ErrorAlert
                // The error kind, so e2e can tell a 403/404 from other failures.
                data-error={error?._tag}
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

/** Capture's overflow menu: changelog, then status, then delete. */
const ProfileActionsMenu = ({
    data,
    onOpenDialog,
}: {
    data: TrackedEntityProfileData
    onOpenDialog: (dialog: Exclude<ProfileDialog, null>) => void
}) => {
    const { permissions, trackedEntity } = data
    const deletePermission = permissions.delete
    const trackedEntityTypeName = trackedEntity.trackedEntityTypeName

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

/** Capture's page-level status tag, which the widget leaves to its host. */
export const InactiveNotice = ({
    data,
}: {
    data: TrackedEntityProfileData | undefined
}) =>
    data?.trackedEntity.inactive ? (
        <p
            role="status"
            className="m-0 mb-2 inline-flex rounded-dhis2-sm bg-dhis2-grey-300 px-2 py-1 text-sm text-dhis2-grey-900"
        >
            {i18n.t('This {{trackedEntityTypeName}} is deactivated', {
                trackedEntityTypeName: data.trackedEntity.trackedEntityTypeName,
                interpolation: { escapeValue: false },
            })}
        </p>
    ) : null

interface EnrollmentProfileProps {
    trackedEntityId: string
    programId: string
    onDeleted: () => void
}

/** Spec Example A: the full Capture composition on an enrollment dashboard. */
export const EnrollmentProfile = ({
    trackedEntityId,
    programId,
    onDeleted,
}: EnrollmentProfileProps) => {
    const profile = useTrackedEntityProfile({ trackedEntityId, programId })
    const { data } = profile
    const [dialog, setDialog] = useState<ProfileDialog>(null)
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setDialog(null)
        }
    }

    return (
        <>
            <InactiveNotice data={data} />
            <ProfileWidget data-testid="profile-widget-enrollment">
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
                        programId={programId}
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
                        onSuccess={onDeleted}
                    />
                </>
            )}
        </>
    )
}
