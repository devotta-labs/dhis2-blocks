import { useState } from 'react'
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupTrigger,
    SidebarHeader,
    SidebarItem,
    SidebarItems,
    SidebarLink,
    SidebarNavigation,
    SidebarProvider,
    SidebarToggle,
} from '@/components/sidebar'

const mainPages = ['Dashboard', 'Projects']
const reportPages = ['Overview', 'Activity', 'Exports']

export default function SidebarBasic() {
    const [page, setPage] = useState('Overview')
    const pageLink = (label: string) => (
        <SidebarItem key={label}>
            <SidebarLink
                href={`#${label.toLowerCase().replaceAll(' ', '-')}`}
                aria-current={page === label ? 'page' : undefined}
                onClick={(event) => {
                    event.preventDefault()
                    setPage(label)
                }}
            >
                {label}
            </SidebarLink>
        </SidebarItem>
    )

    return (
        <SidebarProvider>
            <div className="flex min-h-160 flex-col overflow-hidden rounded-md border border-border bg-background md:h-160 md:flex-row">
                <Sidebar>
                    <SidebarNavigation aria-label="Workspace navigation">
                        <SidebarHeader>
                            <span className="text-base font-medium">
                                Workspace
                            </span>
                        </SidebarHeader>
                        <SidebarContent>
                            <SidebarItems>
                                {mainPages.map(pageLink)}
                                <SidebarGroup defaultOpen>
                                    <SidebarGroupTrigger>
                                        Reports
                                    </SidebarGroupTrigger>
                                    <SidebarGroupContent>
                                        {reportPages.map(pageLink)}
                                    </SidebarGroupContent>
                                </SidebarGroup>
                            </SidebarItems>
                        </SidebarContent>
                        <SidebarFooter>
                            <SidebarItems>{pageLink('Settings')}</SidebarItems>
                        </SidebarFooter>
                    </SidebarNavigation>
                    <SidebarToggle />
                </Sidebar>
                <section
                    aria-label="Selected page"
                    className="min-w-0 flex-1 p-6"
                >
                    <h3 className="text-xl font-medium">{page}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                        Manage projects, review reports, and keep track of your
                        team's work.
                    </p>
                </section>
            </div>
        </SidebarProvider>
    )
}
