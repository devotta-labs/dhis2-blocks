import React, { useState } from 'react'
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from './collapsible'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarInset,
    SidebarProvider,
    SidebarRail,
    SidebarTrigger,
} from './sidebar'
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from './sidebar-menu'

type AppNavigationProps = {
    open?: boolean
    onOpenChange?: (open: boolean) => void
    dir?: 'ltr' | 'rtl'
}

/**
 * A clinic app's navigation: Today is the current page, Reports a group. Wider
 * than the test browser's default viewport, so set one before rendering.
 */
export const AppNavigation = ({
    open,
    onOpenChange,
    dir,
}: AppNavigationProps) => (
    <div dir={dir} className="h-96 w-[800px]">
        <SidebarProvider open={open} onOpenChange={onOpenChange}>
            <Sidebar collapsible="icon" data-testid="sidebar">
                <SidebarContent>
                    <SidebarGroup>
                        <SidebarGroupLabel>Patients</SidebarGroupLabel>
                        <SidebarMenu>
                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    render={
                                        <a href="#today" aria-label="Today" />
                                    }
                                    aria-current="page"
                                    tooltip="Today"
                                >
                                    <span>Today</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton tooltip="Find patient">
                                    <span>Find patient</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <Collapsible
                                defaultOpen
                                render={<SidebarMenuItem />}
                            >
                                <CollapsibleTrigger
                                    render={<SidebarMenuButton />}
                                >
                                    <span>Reports</span>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                    <SidebarMenuSub>
                                        <SidebarMenuSubItem>
                                            <SidebarMenuSubButton
                                                href="#help"
                                                target="_blank"
                                            >
                                                <span>Help</span>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                        <SidebarMenuSubItem>
                                            <SidebarMenuSubButton href="#stock">
                                                <span>Stock</span>
                                            </SidebarMenuSubButton>
                                        </SidebarMenuSubItem>
                                    </SidebarMenuSub>
                                </CollapsibleContent>
                            </Collapsible>
                        </SidebarMenu>
                    </SidebarGroup>
                </SidebarContent>
                <SidebarRail />
            </Sidebar>
            <SidebarInset data-testid="page">
                <SidebarTrigger data-testid="trigger" />
            </SidebarInset>
        </SidebarProvider>
    </div>
)

/** The navigation, with its open state held by the page. */
export const ControlledNavigation = ({
    onOpenChange,
}: {
    onOpenChange: (open: boolean) => void
}) => {
    const [open, setOpen] = useState(true)
    return (
        <>
            <p data-testid="state">{open ? 'open' : 'closed'}</p>
            <AppNavigation
                open={open}
                onOpenChange={(next) => {
                    setOpen(next)
                    onOpenChange(next)
                }}
            />
        </>
    )
}
