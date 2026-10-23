import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { WorkingList } from '@/components/working-list'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupTrigger,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarProvider,
    SidebarToggle,
} from '@/components/sidebar'
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
    selectDisplayInListAttributes,
    useProfileFields,
    useTrackedEntityProfile,
} from '@/components/profile-widget'
import { Host } from './host'
import './index.css'

type ProfileDialog = 'changelog' | 'status' | 'delete' | null

function ProfileWidgetUsage({ trackedEntityId }: { trackedEntityId: string }) {
    const profile = useTrackedEntityProfile({
        trackedEntityId,
        programId: 'program',
        selectFields: (attributes) =>
            selectDisplayInListAttributes(attributes).filter(
                (attribute) => attribute.value.kind !== 'empty'
            ),
    })
    const extra = useProfileFields([
        { id: 'note', label: 'Note', valueType: 'TEXT', value: null },
    ])
    const [dialog, setDialog] = useState<ProfileDialog>(null)
    const { data } = profile
    const closeDialog = (open: boolean) => {
        if (!open) {
            setDialog(null)
        }
    }

    return (
        <>
            <ProfileWidget defaultOpen>
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>
                        {data?.title ?? 'Profile'}
                    </ProfileWidgetTitle>
                    <ProfileWidgetHeaderActions>
                        {data && (
                            <ProfileWidgetMenu>
                                <ProfileWidgetMenuItem
                                    onClick={() => setDialog('changelog')}
                                >
                                    View changelog
                                </ProfileWidgetMenuItem>
                                <ProfileWidgetMenuItem
                                    destructive
                                    disabled={
                                        data.permissions.delete.status ===
                                        'disabled'
                                    }
                                    disabledReason={
                                        data.permissions.delete.status ===
                                        'disabled'
                                            ? data.permissions.delete.reason
                                            : undefined
                                    }
                                    onClick={() => setDialog('delete')}
                                >
                                    Delete
                                </ProfileWidgetMenuItem>
                            </ProfileWidgetMenu>
                        )}
                        <ProfileWidgetToggle />
                    </ProfileWidgetHeaderActions>
                </ProfileWidgetHeader>
                <ProfileWidgetContent>
                    <ProfileWidgetFieldList>
                        {[...(data?.fields ?? []), ...(extra.data ?? [])].map(
                            (field) => (
                                <ProfileWidgetField
                                    key={field.id}
                                    label={field.label}
                                >
                                    <ProfileWidgetValue value={field.value} />
                                </ProfileWidgetField>
                            )
                        )}
                    </ProfileWidgetFieldList>
                </ProfileWidgetContent>
            </ProfileWidget>
            {data && (
                <>
                    <ProfileWidgetChangelogDialog
                        open={dialog === 'changelog'}
                        onOpenChange={closeDialog}
                        trackedEntityId={data.trackedEntity.id}
                        programId="program"
                        attributes={data.attributes}
                    />
                    <ProfileWidgetStatusDialog
                        open={dialog === 'status'}
                        onOpenChange={closeDialog}
                        trackedEntity={data.trackedEntity}
                        onSuccess={(inactive) => inactive}
                    />
                    <ProfileWidgetDeleteDialog
                        open={dialog === 'delete'}
                        onOpenChange={closeDialog}
                        trackedEntity={data.trackedEntity}
                        onSuccess={() => setDialog(null)}
                    />
                </>
            )}
        </>
    )
}

// Type-level use only: the check compiles and bundles this file, never runs it.
const root = document.getElementById('root')
if (root !== null) {
    createRoot(root).render(
        <>
            <Host />
            <SidebarProvider>
                <Sidebar>
                    <SidebarNavigation>
                        <SidebarContent>
                            <SidebarItems>
                                <SidebarGroup defaultOpen>
                                    <SidebarGroupTrigger>
                                        Evaluate
                                    </SidebarGroupTrigger>
                                    <SidebarGroupContent>
                                        <SidebarItem>
                                            <SidebarLink
                                                href="/evaluate"
                                                aria-current="page"
                                            >
                                                Overview
                                            </SidebarLink>
                                        </SidebarItem>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </SidebarItems>
                        </SidebarContent>
                    </SidebarNavigation>
                    <SidebarToggle />
                </Sidebar>
            </SidebarProvider>
            <ProfileWidget>
                <ProfileWidgetHeader>
                    <ProfileWidgetTitle>Person profile</ProfileWidgetTitle>
                    <ProfileWidgetHeaderActions>
                        <ProfileWidgetToggle />
                    </ProfileWidgetHeaderActions>
                </ProfileWidgetHeader>
                <ProfileWidgetContent>
                    <ProfileWidgetFieldList>
                        <ProfileWidgetField label="First name">
                            <ProfileWidgetValue
                                value={{ kind: 'text', text: 'Anna' }}
                            />
                        </ProfileWidgetField>
                    </ProfileWidgetFieldList>
                </ProfileWidgetContent>
            </ProfileWidget>
            <ProfileWidgetUsage trackedEntityId="trackedEntity" />
            <ContextSelector>{null}</ContextSelector>
            <WorkingList programId="program" orgUnitId="orgUnit">
                {null}
            </WorkingList>
        </>
    )
}
