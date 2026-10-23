import i18n from '@dhis2/d2-i18n'
import { useState } from 'react'
import { ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { Spinner } from '@/components/dhis2/ui/spinner'
import {
    ProfileWidget,
    ProfileWidgetChangelogDialog,
    ProfileWidgetContent,
    ProfileWidgetField,
    ProfileWidgetFieldList,
    ProfileWidgetHeader,
    ProfileWidgetHeaderActions,
    ProfileWidgetStatusDialog,
    ProfileWidgetTitle,
    ProfileWidgetToggle,
    ProfileWidgetValue,
    useTrackedEntityProfile,
    type TrackedEntityProfileData,
} from '@/components/profile-widget'

/**
 * No program, with the actions in a toolbar outside the widget.
 *
 * `PQfMcpmXeFE` (John Kelly) exists in the DHIS2 Sierra Leone demo database.
 * Without a program, the rows are the tracked entity type's `displayInList`
 * attributes. Replace the ID with a tracked entity from your own instance.
 */
const TRACKED_ENTITY_ID = 'PQfMcpmXeFE'

type ProfileDialog = 'changelog' | 'status' | null

/** Any part of the page can open the dialogs: their state lives in the page. */
function RecordToolbar({
    data,
    onOpenDialog,
}: {
    data: TrackedEntityProfileData
    onOpenDialog: (dialog: Exclude<ProfileDialog, null>) => void
}) {
    const { permissions, trackedEntity } = data

    return (
        <div className="flex gap-2">
            {permissions.changelog.status === 'available' && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenDialog('changelog')}
                >
                    {i18n.t('View changelog')}
                </Button>
            )}
            {permissions.setInactive.status === 'available' && (
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onOpenDialog('status')}
                >
                    {trackedEntity.inactive
                        ? i18n.t('Activate')
                        : i18n.t('Deactivate')}
                </Button>
            )}
        </div>
    )
}

const ProfileWidgetToolbar = () => {
    const { data, error, isPending } = useTrackedEntityProfile({
        trackedEntityId: TRACKED_ENTITY_ID,
    })
    const [dialog, setDialog] = useState<ProfileDialog>(null)
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setDialog(null)
        }
    }

    return (
        <div className="max-w-md">
            <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
                <h2 className="m-0 text-base font-medium">
                    {i18n.t('Tracked entity')}
                </h2>
                {data && <RecordToolbar data={data} onOpenDialog={setDialog} />}
            </div>

            <ProfileWidget>
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>
                        {data?.displayName || i18n.t('Profile')}
                    </ProfileWidgetTitle>
                    <ProfileWidgetHeaderActions>
                        {/* The block shows no inactive badge; render your own. */}
                        {data?.trackedEntity.inactive && (
                            <span className="rounded-dhis2-sm bg-dhis2-grey-200 px-1.5 py-0.5 text-xs text-dhis2-grey-800">
                                {i18n.t('Inactive')}
                            </span>
                        )}
                        <ProfileWidgetToggle />
                    </ProfileWidgetHeaderActions>
                </ProfileWidgetHeader>
                <ProfileWidgetContent>
                    {isPending ? (
                        <Spinner
                            className="size-6 border-4"
                            aria-label={i18n.t('Loading profile')}
                        />
                    ) : error || !data ? (
                        <ErrorAlert
                            title={i18n.t(
                                'Profile widget could not be loaded. Please try again later'
                            )}
                        />
                    ) : (
                        <ProfileWidgetFieldList>
                            {data.fields.map((field) => (
                                <ProfileWidgetField
                                    key={field.id}
                                    label={field.label}
                                >
                                    <ProfileWidgetValue value={field.value} />
                                </ProfileWidgetField>
                            ))}
                        </ProfileWidgetFieldList>
                    )}
                </ProfileWidgetContent>
            </ProfileWidget>

            {data && (
                <>
                    <ProfileWidgetChangelogDialog
                        open={dialog === 'changelog'}
                        onOpenChange={handleDialogOpenChange}
                        trackedEntityId={data.trackedEntity.id}
                        attributes={data.attributes}
                    />
                    <ProfileWidgetStatusDialog
                        open={dialog === 'status'}
                        onOpenChange={handleDialogOpenChange}
                        trackedEntity={data.trackedEntity}
                    />
                </>
            )}
        </div>
    )
}

export default ProfileWidgetToolbar
