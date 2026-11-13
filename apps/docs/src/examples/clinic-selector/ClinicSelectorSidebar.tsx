import {
    ClinicProvider,
    ClinicSelector,
    useClinic,
} from '@/components/clinic-selector'
import {
    Sidebar,
    SidebarContent,
    SidebarHeader,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarProvider,
    SidebarToggle,
    useSidebar,
} from '@/components/sidebar'

/** Reads the sidebar's state, so it sits inside `SidebarProvider`. */
function ClinicHeader() {
    const { state } = useSidebar()
    return (
        <SidebarHeader>
            <ClinicSelector collapsed={state.collapsed} />
        </SidebarHeader>
    )
}

/** Any page under the provider can scope its data to the current clinic. */
function ClinicPage() {
    const { clinic, status } = useClinic()
    return (
        <section aria-label="Selected page" className="min-w-0 flex-1 p-6">
            <h3 className="text-xl font-medium">
                {clinic?.displayName ?? 'No clinic'}
            </h3>
            <p className="mt-3 text-sm text-muted-foreground">
                Status: {status}
            </p>
        </section>
    )
}

export default function ClinicSelectorSidebar() {
    return (
        <ClinicProvider>
            <SidebarProvider>
                <div className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-background md:flex-row">
                    <Sidebar>
                        {/* Outside the navigation, which is hidden while collapsed, so the clinic's tile stays. */}
                        <ClinicHeader />
                        <SidebarNavigation aria-label="Workspace navigation">
                            <SidebarContent>
                                <SidebarItems>
                                    <SidebarItem>
                                        <SidebarLink
                                            href="#visits"
                                            aria-current="page"
                                        >
                                            Visits
                                        </SidebarLink>
                                    </SidebarItem>
                                    <SidebarItem>
                                        <SidebarLink href="#stock">
                                            Stock
                                        </SidebarLink>
                                    </SidebarItem>
                                </SidebarItems>
                            </SidebarContent>
                        </SidebarNavigation>
                        <SidebarToggle />
                    </Sidebar>
                    <ClinicPage />
                </div>
            </SidebarProvider>
        </ClinicProvider>
    )
}
