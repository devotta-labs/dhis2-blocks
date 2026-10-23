import { Button } from '@/components/dhis2/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/dhis2/ui/tooltip'
import {
    ProfileWidget,
    ProfileWidgetChangelogDialog,
    ProfileWidgetContent,
    ProfileWidgetDeleteDialog,
    ProfileWidgetHeader,
    ProfileWidgetHeaderActions,
    ProfileWidgetMenu,
    ProfileWidgetMenuItem,
    ProfileWidgetStatusDialog,
    ProfileWidgetTitle,
    ProfileWidgetToggle,
    useTrackedEntityProfile,
    type TrackedEntityProfileData,
} from '@/components/profile-widget'
import React, { useState } from 'react'
import i18n from '../../i18n'
import {
    InactiveNotice,
    ProfileBody,
    type ProfileDialog,
} from './EnrollmentProfile'

const PersonToolbar = ({
    data,
    onOpenDialog,
}: {
    data: TrackedEntityProfileData
    onOpenDialog: (dialog: Exclude<ProfileDialog, null>) => void
}) => {
    const { permissions, trackedEntity } = data
    const deletePermission = permissions.delete

    return (
        <div
            role="toolbar"
            aria-label={i18n.t('Tracked entity actions')}
            className="flex gap-2"
        >
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
            {deletePermission.status === 'available' && (
                <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => onOpenDialog('delete')}
                >
                    {i18n.t('Delete')}
                </Button>
            )}
            {deletePermission.status === 'disabled' && (
                <Tooltip>
                    <TooltipTrigger render={<span tabIndex={0} />}>
                        <Button variant="destructive" size="sm" disabled>
                            {i18n.t('Delete')}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>{deletePermission.reason}</TooltipContent>
                </Tooltip>
            )}
        </div>
    )
}

interface PersonPanelProps {
    trackedEntityId: string
    onDeleted: () => void
}

export const PersonPanel = ({
    trackedEntityId,
    onDeleted,
}: PersonPanelProps) => {
    const profile = useTrackedEntityProfile({ trackedEntityId })
    const { data } = profile
    const [dialog, setDialog] = useState<ProfileDialog>(null)
    const handleDialogOpenChange = (open: boolean) => {
        if (!open) {
            setDialog(null)
        }
    }

    return (
        <>
            <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="m-0 text-base font-medium">
                    {i18n.t('Tracked entity')}
                </h2>
                {data && <PersonToolbar data={data} onOpenDialog={setDialog} />}
            </div>
            <InactiveNotice data={data} />

            <ProfileWidget data-testid="profile-widget-person">
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>
                        {data?.displayName || i18n.t('Person')}
                    </ProfileWidgetTitle>
                    <ProfileWidgetHeaderActions>
                        {data?.permissions.changelog.status === 'available' && (
                            <ProfileWidgetMenu>
                                <ProfileWidgetMenuItem
                                    onClick={() => setDialog('changelog')}
                                >
                                    {i18n.t('View changelog')}
                                </ProfileWidgetMenuItem>
                            </ProfileWidgetMenu>
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
