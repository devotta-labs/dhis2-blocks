import { ChevronDownIcon } from 'lucide-react'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useCallback, useEffect, useId, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { docsNavigation } from '../navigation'

const repositoryUrl = 'https://github.com/devotta-labs/dhis2-blocks'

const useDarkMode = () => {
    const [dark, setDark] = useState(
        () =>
            window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    )

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark)
    }, [dark])

    return { dark, toggle: () => setDark((value) => !value) }
}

const ThemeIcon = ({ dark }: { dark: boolean }) =>
    dark ? (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m11.4-11.4 1.4-1.4" />
        </svg>
    ) : (
        <svg
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
    )

const SidebarLink = ({
    title,
    href,
    onNavigate,
}: {
    title: string
    href: string
    onNavigate?: () => void
}) => (
    <NavLink
        to={href}
        end={href === '/'}
        onClick={onNavigate}
        className={({ isActive }) =>
            [
                '-ml-px block border-l-2 py-1 pr-2 pl-4 text-sm transition-colors',
                isActive
                    ? 'border-primary font-medium text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')
        }
    >
        {title}
    </NavLink>
)

type NavigationSection = (typeof docsNavigation)[number]
type NavigationLinks = Extract<NavigationSection, { links: unknown }>['links']
type NavigationCategory = Extract<
    NavigationSection,
    { categories: unknown }
>['categories'][number]

const SidebarLinks = ({
    links,
    onNavigate,
}: {
    links: NavigationLinks
    onNavigate?: () => void
}) => (
    <ul className="flex flex-col border-l border-border">
        {links.map((link) => (
            <li key={link.href}>
                <SidebarLink {...link} onNavigate={onNavigate} />
            </li>
        ))}
        {links.length === 0 && (
            <li className="py-1 pr-2 pl-4 text-sm text-muted-foreground/60">
                Coming soon
            </li>
        )}
    </ul>
)

/** A category of blocks, folded away by its heading. */
const SidebarCategory = ({
    category,
    onNavigate,
}: {
    category: NavigationCategory
    onNavigate?: () => void
}) => {
    const [open, setOpen] = useState(true)
    const listId = useId()

    return (
        <div>
            <button
                type="button"
                aria-expanded={open}
                aria-controls={listId}
                onClick={() => setOpen((value) => !value)}
                className="flex w-full items-center justify-between rounded-sm px-2 py-1 text-[13px] font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
                {category.title}
                <ChevronDownIcon
                    aria-hidden="true"
                    className={`size-3.5 transition-transform duration-200 ${open ? '' : '-rotate-90'}`}
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key="links"
                        id={listId}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                    >
                        <div className="mt-0.5 mb-1 ml-2">
                            <SidebarLinks
                                links={category.links}
                                onNavigate={onNavigate}
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <MotionConfig reducedMotion="user">
        <nav aria-label="Documentation" className="flex flex-col gap-6 px-1">
            {docsNavigation.map((section) => (
                <div key={section.title}>
                    <p className="mb-1.5 px-2 text-sm font-semibold text-foreground">
                        {section.title}
                    </p>
                    {'categories' in section ? (
                        <div className="flex flex-col gap-1">
                            {section.categories.map((category) => (
                                <SidebarCategory
                                    key={category.title}
                                    category={category}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </div>
                    ) : (
                        <SidebarLinks
                            links={section.links}
                            onNavigate={onNavigate}
                        />
                    )}
                </div>
            ))}
        </nav>
    </MotionConfig>
)

const primaryLink = ({ isActive }: { isActive: boolean }) =>
    [
        'text-sm transition-colors',
        isActive
            ? 'font-medium text-foreground'
            : 'text-muted-foreground hover:text-foreground',
    ].join(' ')

/**
 * The header, theme and mobile navigation every page shares. Docs pages add
 * their sidebar through `DocsLayout`; the playground fills the rest itself.
 */
export const SiteShell = () => {
    const [mobileOpen, setMobileOpen] = useState(false)
    const { dark, toggle } = useDarkMode()
    const location = useLocation()

    useEffect(() => {
        setMobileOpen(false)
    }, [location.pathname])

    const closeMobile = useCallback(() => setMobileOpen(false), [])

    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="fixed inset-x-0 top-0 z-50 h-14 border-b border-border bg-background/95 backdrop-blur">
                <div className="flex h-full items-center gap-3 px-4 md:px-6">
                    <button
                        type="button"
                        aria-label="Toggle navigation"
                        aria-expanded={mobileOpen}
                        onClick={() => setMobileOpen((open) => !open)}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
                    >
                        <svg
                            viewBox="0 0 24 24"
                            className="size-4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            aria-hidden="true"
                        >
                            <path d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>

                    <Link
                        to="/"
                        className="flex items-center gap-2 font-semibold"
                        aria-label="DHIS2 Blocks"
                    >
                        <span className="relative h-6 w-7 shrink-0">
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
                        <span>Blocks</span>
                    </Link>

                    <nav
                        aria-label="Primary"
                        className="ml-5 hidden items-center gap-5 md:flex"
                    >
                        <NavLink to="/installation" className={primaryLink}>
                            Docs
                        </NavLink>
                        <NavLink
                            to="/blocks/working-list"
                            className={primaryLink}
                        >
                            Blocks
                        </NavLink>
                        <NavLink to="/playground" className={primaryLink}>
                            Playground
                        </NavLink>
                    </nav>

                    <div className="ml-auto flex items-center gap-1.5">
                        <a
                            href={repositoryUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex h-7 items-center justify-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                            GitHub
                        </a>
                        <button
                            type="button"
                            onClick={toggle}
                            aria-label="Toggle theme"
                            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                            <ThemeIcon dark={dark} />
                        </button>
                    </div>
                </div>
            </header>

            {mobileOpen && (
                <div className="fixed inset-0 top-14 z-40 md:hidden">
                    <button
                        type="button"
                        aria-label="Close navigation"
                        className="absolute inset-0 bg-black/40"
                        onClick={closeMobile}
                    />
                    <aside className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-border bg-background p-4">
                        <SidebarContent onNavigate={closeMobile} />
                    </aside>
                </div>
            )}

            <div className="pt-14">
                <Outlet />
            </div>
        </div>
    )
}

/** A docs page: the documentation sidebar beside the page. */
export const DocsLayout = () => (
    <div className="mx-auto flex max-w-[1536px]">
        <aside className="fixed top-14 bottom-0 hidden w-60 shrink-0 overflow-y-auto border-r border-border py-8 pr-4 md:block">
            <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 md:pl-72 md:pr-8 lg:pr-12">
            <Outlet />
        </main>
    </div>
)
