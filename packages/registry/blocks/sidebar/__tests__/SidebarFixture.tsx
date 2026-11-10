import React from 'react'
import {
    Sidebar,
    SidebarContent,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarProvider,
} from '../index'

/** A sidebar with a current page and another page. */
export const SidebarFixture = () => (
    <SidebarProvider>
        <Sidebar>
            <SidebarNavigation aria-label="Pages">
                <SidebarContent>
                    <SidebarItems>
                        <SidebarItem>
                            <SidebarLink href="#home" aria-current="page">
                                Home
                            </SidebarLink>
                        </SidebarItem>
                        <SidebarItem>
                            <SidebarLink href="#reports">Reports</SidebarLink>
                        </SidebarItem>
                    </SidebarItems>
                </SidebarContent>
            </SidebarNavigation>
        </Sidebar>
    </SidebarProvider>
)
