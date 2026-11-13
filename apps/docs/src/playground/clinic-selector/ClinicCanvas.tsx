import {
    ClinicProvider,
    ClinicSelector,
    useClinic,
    type Clinic,
} from '@/components/clinic-selector'
import { Button } from '@/components/dhis2/ui/button'
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
} from '@/components/sidebar'

interface Props {
    collapsed: boolean
    label: string
    value?: string
    onCollapsedChange: (collapsed: boolean) => void
    onValueChange: (clinic: Clinic) => void
}

/** What the rest of the app sees through `useClinic()`. */
const ClinicPage = () => {
    const { status, clinic, retry } = useClinic()
    return (
        <section
            aria-label="Page"
            className="flex min-w-0 flex-1 flex-col gap-3 p-6 text-sm"
        >
            <h3 className="m-0 text-xl font-medium break-words">
                {clinic?.displayName ?? 'No clinic'}
            </h3>
            <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-dhis2-muted-foreground">
                <dt>Status</dt>
                <dd className="m-0 font-mono">{status}</dd>
                <dt>Id</dt>
                <dd className="m-0 font-mono">{clinic?.id ?? '–'}</dd>
                <dt>Path</dt>
                <dd className="m-0 font-mono break-all">
                    {clinic?.path ?? '–'}
                </dd>
            </dl>
            <Button
                variant="outline"
                size="sm"
                className="self-start"
                onClick={retry}
            >
                Retry
            </Button>
        </section>
    )
}

export const ClinicCanvas = ({
    collapsed,
    label,
    value,
    onCollapsedChange,
    onValueChange,
}: Props) => (
    <ClinicProvider value={value} onValueChange={onValueChange}>
        <SidebarProvider
            collapsed={collapsed}
            onCollapsedChange={onCollapsedChange}
        >
            <div className="flex min-h-96 w-full flex-col overflow-hidden rounded-md border border-dhis2-border bg-dhis2-background md:flex-row">
                <Sidebar>
                    {/* Outside the navigation, which is hidden while collapsed, so the tile stays. */}
                    <SidebarHeader>
                        <ClinicSelector collapsed={collapsed} label={label} />
                    </SidebarHeader>
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
                                    <SidebarLink href="#patients">
                                        Patients
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
