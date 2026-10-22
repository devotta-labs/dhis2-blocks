import { useState } from 'react'
import {
    Sidebar,
    SidebarButton,
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
const otherPages = ['Calendar', 'Messages', 'Files', 'Tasks']

export default function SidebarBasic() {
    const [page, setPage] = useState('Overview')
    const [notice, setNotice] = useState('')
    const pageLink = (label: string) => (
        <SidebarItem key={label}>
            <SidebarLink
                href={`#${label.toLowerCase().replaceAll(' ', '-')}`}
                aria-current={page === label ? 'page' : undefined}
                onClick={(event) => {
                    event.preventDefault()
                    setPage(label)
                    setNotice('')
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
                                {otherPages.map(pageLink)}
                            </SidebarItems>
                        </SidebarContent>
                        <SidebarFooter>
                            <SidebarItems>
                                <SidebarItem>
                                    <SidebarButton
                                        onClick={() =>
                                            setNotice(
                                                'Demo: contact support selected.'
                                            )
                                        }
                                    >
                                        Contact support
                                    </SidebarButton>
                                </SidebarItem>
                                {['Guides', 'Settings'].map(pageLink)}
                            </SidebarItems>
                        </SidebarFooter>
                    </SidebarNavigation>
                    <SidebarToggle />
                </Sidebar>
                <section
                    aria-label="Selected page"
                    className="min-w-0 flex-1 p-6"
                >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Workspace
                    </p>
                    <h3 className="mt-2 text-xl font-medium">{page}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                        Manage projects, review reports, and keep track of your
                        team's work.
                    </p>
                    <p role="status" className="mt-4 text-sm">
                        {notice}
                    </p>
                </section>
            </div>
        </SidebarProvider>
    )
}
