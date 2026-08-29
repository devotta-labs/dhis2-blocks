'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
    FullSearchTrigger,
    SearchTrigger,
} from 'fumadocs-ui/layouts/shared/slots/search-trigger'
import { ThemeSwitch } from 'fumadocs-ui/layouts/shared/slots/theme-switch'
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarSeparator,
    SidebarTrigger,
    useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

const repositoryUrl = 'https://github.com/devotta-labs/dhis2-blocks'

const primaryNavigation = [
    { label: 'Components', href: '/components' },
    { label: 'Blocks', href: '/blocks' },
    { label: 'Examples', href: '/examples' },
]

const blocksNavigation = [
    { label: 'Working List', href: '/blocks/working-list' },
]

function BlocksBrand() {
    return (
        <span className="flex items-center gap-2 font-semibold">
            <span className="relative h-6 w-7 shrink-0" aria-hidden="true">
                <img
                    src="/dhis2-symbol.svg"
                    alt=""
                    className="absolute inset-0 h-full w-full object-contain dark:hidden"
                />
                <img
                    src="/dhis2-symbol-reversed.svg"
                    alt=""
                    className="absolute inset-0 hidden h-full w-full object-contain dark:block"
                />
            </span>
            <span className="max-sm:hidden">Blocks</span>
            <span className="sr-only">DHIS2 Blocks</span>
        </span>
    )
}

function NavigationLink({ label, href }: (typeof primaryNavigation)[number]) {
    const pathname = usePathname()
    const isActive = pathname === href || pathname.startsWith(`${href}/`)

    return (
        <Link
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
                'text-sm text-muted-foreground transition-colors hover:text-foreground',
                isActive && 'font-medium text-foreground'
            )}
        >
            {label}
        </Link>
    )
}

function SiteHeader() {
    return (
        <header className="fixed inset-x-0 top-0 z-50 h-14 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
            <div className="flex h-full items-center gap-3 px-4 md:px-6">
                <SidebarTrigger className="md:hidden" />
                <Link href="/blocks" aria-label="DHIS2 Blocks">
                    <BlocksBrand />
                </Link>

                <nav
                    aria-label="Primary navigation"
                    className="ml-5 hidden items-center gap-5 md:flex"
                >
                    {primaryNavigation.map((item) => (
                        <NavigationLink key={item.href} {...item} />
                    ))}
                </nav>

                <div className="ml-auto flex items-center gap-1.5">
                    <FullSearchTrigger
                        hideIfDisabled
                        className="hidden w-52 lg:inline-flex"
                    />
                    <SearchTrigger hideIfDisabled className="lg:hidden" />
                    <a
                        href={repositoryUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        aria-label="GitHub repository"
                        className="inline-flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        GitHub
                    </a>
                    <ThemeSwitch mode="light-dark-system" />
                </div>
            </div>
        </header>
    )
}

function SidebarLink({ label, href }: (typeof primaryNavigation)[number]) {
    const pathname = usePathname()
    const { setOpenMobile } = useSidebar()
    const isActive = pathname === href || pathname.startsWith(`${href}/`)

    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                render={
                    <Link href={href} onClick={() => setOpenMobile(false)} />
                }
                isActive={isActive}
            >
                <span>{label}</span>
            </SidebarMenuButton>
        </SidebarMenuItem>
    )
}

function DocsSidebar() {
    return (
        <Sidebar
            collapsible="offcanvas"
            className="md:top-14 md:bottom-0 md:h-[calc(100svh-3.5rem)]"
        >
            <SidebarHeader className="border-b p-4 md:hidden">
                <span className="text-sm font-medium">Documentation</span>
            </SidebarHeader>
            <SidebarContent className="py-2">
                <SidebarGroup className="md:hidden">
                    <SidebarGroupLabel>Explore</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {primaryNavigation.map((item) => (
                                <SidebarLink key={item.href} {...item} />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <SidebarSeparator className="md:hidden" />
                <SidebarGroup>
                    <SidebarGroupLabel>Tracker</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {blocksNavigation.map((item) => (
                                <SidebarLink key={item.href} {...item} />
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    )
}

export function DocsShell({ children }: { children: React.ReactNode }) {
    return (
        <SidebarProvider className="pt-14">
            <SiteHeader />
            <DocsSidebar />
            <div className="min-w-0 flex-1">{children}</div>
        </SidebarProvider>
    )
}
