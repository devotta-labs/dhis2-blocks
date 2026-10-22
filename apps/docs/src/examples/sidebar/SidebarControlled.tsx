import { useState } from 'react'
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
    useSidebar,
} from '@/components/sidebar'

function ToolbarToggle() {
    const { state, actions, meta } = useSidebar()

    return (
        <button
            type="button"
            aria-controls={meta.navigationId}
            aria-expanded={!state.collapsed}
            className="rounded-md border border-border px-3 py-2 hover:bg-muted"
            onClick={() => actions.setCollapsed(!state.collapsed)}
        >
            {state.collapsed ? 'Show navigation' : 'Hide navigation'}
        </button>
    )
}

export default function SidebarControlled() {
    const [collapsed, setCollapsed] = useState(false)
    const [groupOpen, setGroupOpen] = useState(true)
    const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')

    return (
        <SidebarProvider collapsed={collapsed} onCollapsedChange={setCollapsed}>
            <div
                dir={direction}
                className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-background md:h-80 md:flex-row"
            >
                <Sidebar>
                    <SidebarNavigation aria-label="Administration navigation">
                        <SidebarContent>
                            <SidebarItems>
                                <SidebarGroup
                                    open={groupOpen}
                                    onOpenChange={setGroupOpen}
                                >
                                    <SidebarGroupTrigger>
                                        Administration
                                    </SidebarGroupTrigger>
                                    <SidebarGroupContent>
                                        <SidebarItem>
                                            <SidebarLink
                                                href="#users"
                                                aria-current="page"
                                                onClick={(event) =>
                                                    event.preventDefault()
                                                }
                                            >
                                                Users
                                            </SidebarLink>
                                        </SidebarItem>
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </SidebarItems>
                        </SidebarContent>
                    </SidebarNavigation>
                    <SidebarToggle />
                </Sidebar>
                <section
                    aria-label="Sidebar controls"
                    className="min-w-0 flex-1 space-y-4 p-6 text-sm"
                >
                    <h3 className="font-medium">Navigation controls</h3>
                    <ToolbarToggle />
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={direction === 'rtl'}
                            onChange={(event) =>
                                setDirection(
                                    event.target.checked ? 'rtl' : 'ltr'
                                )
                            }
                        />
                        Right-to-left layout
                    </label>
                    <p className="text-muted-foreground">
                        Use either button to show or hide navigation.
                    </p>
                </section>
            </div>
        </SidebarProvider>
    )
}
