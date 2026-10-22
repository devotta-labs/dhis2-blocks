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
    SidebarToggle,
} from '@/components/sidebar'

export default function SidebarControlled() {
    const [collapsed, setCollapsed] = useState(false)
    const [groupOpen, setGroupOpen] = useState(true)
    const [direction, setDirection] = useState<'ltr' | 'rtl'>('ltr')

    return (
        <div
            dir={direction}
            className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-background md:h-80 md:flex-row"
        >
            <Sidebar collapsed={collapsed} onCollapsedChange={setCollapsed}>
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
                <h3 className="font-medium">App-owned state</h3>
                <button
                    type="button"
                    className="rounded-md border border-border px-3 py-2 hover:bg-muted"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    {collapsed ? 'Show navigation' : 'Hide navigation'}
                </button>
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={direction === 'rtl'}
                        onChange={(event) =>
                            setDirection(event.target.checked ? 'rtl' : 'ltr')
                        }
                    />
                    Right-to-left layout
                </label>
                <p className="text-muted-foreground">
                    The page toolbar and sidebar toggle share the same state.
                </p>
            </section>
        </div>
    )
}
