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

const mainPages = ['Dashboard', 'Datasets']
const evaluationPages = ['Overview', 'Compare', 'Benchmarks']
const otherPages = ['Predict', 'Alert policies', 'Models', 'Jobs']

export default function SidebarModeling() {
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
                    <SidebarNavigation aria-label="Modeling navigation">
                        <SidebarHeader>
                            <span className="text-base font-medium">
                                Modeling
                            </span>
                        </SidebarHeader>
                        <SidebarContent>
                            <SidebarItems>
                                {mainPages.map(pageLink)}
                                <SidebarGroup defaultOpen>
                                    <SidebarGroupTrigger>
                                        Evaluate
                                    </SidebarGroupTrigger>
                                    <SidebarGroupContent>
                                        {evaluationPages.map(pageLink)}
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
                                                'Your app opens its bug report dialog here.'
                                            )
                                        }
                                    >
                                        Report a bug
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
                        Modeling workspace
                    </p>
                    <h3 className="mt-2 text-xl font-medium">{page}</h3>
                    <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
                        Select a page, expand Evaluate, or collapse the sidebar.
                        Navigation and footer actions belong to your app.
                    </p>
                    <p role="status" className="mt-4 text-sm">
                        {notice}
                    </p>
                </section>
            </div>
        </SidebarProvider>
    )
}
