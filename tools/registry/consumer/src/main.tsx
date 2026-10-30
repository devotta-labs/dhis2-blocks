import { createRoot } from 'react-dom/client'
import { ContextSelector } from '@/components/context-selector'
import { DataEntry, DataGrid, eventSource } from '@/components/data-entry'
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
import { Host } from './host'
import './index.css'

const events = eventSource({ programId: 'program', orgUnitId: 'orgUnit' })

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
            <ContextSelector>{null}</ContextSelector>
            <WorkingList programId="program" orgUnitId="orgUnit">
                {null}
            </WorkingList>
            <DataEntry source={events}>
                <DataGrid />
            </DataEntry>
        </>
    )
}
