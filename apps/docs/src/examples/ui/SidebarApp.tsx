import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/dhis2/ui/collapsible'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from '@/components/dhis2/ui/sidebar'
import {
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from '@/components/dhis2/ui/sidebar-menu'
import {
    IconAddCircle16,
    IconCalendar16,
    IconChevronRight16,
    IconSearch16,
    IconSettings16,
    IconVisualizationColumn16,
} from '@dhis2/ui-icons'
import { useState, type ReactNode } from 'react'

const reports = ['Visits this month', 'Missed appointments', 'Stock']

/** A clinic app's navigation: it collapses to icons, and to a sheet on a narrow window. */
export default function SidebarApp() {
    const [page, setPage] = useState('Today')
    const link = (label: string) => ({
        href: `#${label.toLowerCase().replaceAll(' ', '-')}`,
        'aria-current': page === label ? ('page' as const) : undefined,
        onClick: () => setPage(label),
    })
    const item = (label: string, icon: ReactNode, badge?: string) => (
        <SidebarMenuItem key={label}>
            <SidebarMenuButton
                isActive={page === label}
                onClick={() => setPage(label)}
                tooltip={label}
            >
                {icon}
                <span>{label}</span>
            </SidebarMenuButton>
            {badge && <SidebarMenuBadge>{badge}</SidebarMenuBadge>}
        </SidebarMenuItem>
    )

    return (
        <SidebarProvider className="h-140 overflow-hidden rounded-md border border-border">
            <Sidebar collapsible="icon">
                <SidebarHeader>
                    <span className="truncate px-2 py-1 text-sm font-medium group-data-[collapsible=icon]:hidden">
                        Ngelehun CHC
                    </span>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Patients</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {item('Today', <IconCalendar16 />, '12')}
                                {item('Find patient', <IconSearch16 />)}
                                {item('Register patient', <IconAddCircle16 />)}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                    <SidebarGroup>
                        <SidebarGroupLabel>Clinic</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                <Collapsible
                                    defaultOpen
                                    className="group/collapsible"
                                    render={<SidebarMenuItem />}
                                >
                                    <CollapsibleTrigger
                                        render={
                                            <SidebarMenuButton tooltip="Reports" />
                                        }
                                    >
                                        <IconVisualizationColumn16 />
                                        <span>Reports</span>
                                        <span className="ms-auto flex transition-transform group-data-open/collapsible:rotate-90 motion-reduce:transition-none rtl:-scale-x-100">
                                            <IconChevronRight16 />
                                        </span>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                        <SidebarMenuSub>
                                            {reports.map((label) => (
                                                <SidebarMenuSubItem key={label}>
                                                    <SidebarMenuSubButton
                                                        {...link(label)}
                                                    >
                                                        <span>{label}</span>
                                                    </SidebarMenuSubButton>
                                                </SidebarMenuSubItem>
                                            ))}
                                        </SidebarMenuSub>
                                    </CollapsibleContent>
                                </Collapsible>
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarFooter>
                    <SidebarMenu>
                        {item('Settings', <IconSettings16 />)}
                    </SidebarMenu>
                </SidebarFooter>
                <SidebarRail />
            </Sidebar>
            <SidebarInset>
                <header className="flex items-center gap-2 border-b border-border p-2">
                    <SidebarTrigger />
                    <h3 className="text-sm font-medium">{page}</h3>
                </header>
                <p className="max-w-sm p-4 text-sm leading-6 text-muted-foreground">
                    Press the button, click the edge, or use Ctrl or ⌘ and B to
                    collapse the navigation.
                </p>
            </SidebarInset>
        </SidebarProvider>
    )
}
