import { useCallback, useEffect, useState } from 'react'
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

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav aria-label="Documentation" className="flex flex-col gap-6 px-1">
        {docsNavigation.map((group) => (
            <div key={group.title}>
                <p className="mb-2 px-2 text-sm font-semibold text-foreground">
                    {group.title}
                </p>

                <ul className="flex flex-col gap-0.5 border-l border-border">
                    {group.items.map((item) => (
                        <li key={item.href}>
                            <NavLink
                                to={item.href}
                                end={item.href === '/'}
                                onClick={onNavigate}
                                className={({ isActive }) =>
                                    [
                                        '-ml-px block border-l-2 py-1.5 pr-2 pl-4 text-sm transition-colors',
                                        isActive
                                            ? 'border-primary font-medium text-foreground'
                                            : 'border-transparent text-muted-foreground hover:text-foreground',
                                    ].join(' ')
                                }
                            >
                                {item.title}
                            </NavLink>
                        </li>
                    ))}
                </ul>
            </div>
        ))}
    </nav>
)

export const DocsShell = () => {
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
                <div className="mx-auto flex h-full max-w-[1536px] items-center gap-3 px-4 md:px-6">
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
                        <NavLink
                            to="/getting-started"
                            className={({ isActive }) =>
                                [
                                    'text-sm transition-colors',
                                    isActive
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                ].join(' ')
                            }
                        >
                            Docs
                        </NavLink>
                        <NavLink
                            to="/blocks/working-list"
                            className={({ isActive }) =>
                                [
                                    'text-sm transition-colors',
                                    isActive
                                        ? 'font-medium text-foreground'
                                        : 'text-muted-foreground hover:text-foreground',
                                ].join(' ')
                            }
                        >
                            Blocks
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

            <div className="mx-auto flex max-w-[1536px] pt-14">
                <aside className="fixed top-14 bottom-0 hidden w-60 shrink-0 overflow-y-auto border-r border-border py-8 pr-4 md:block">
                    <SidebarContent />
                </aside>

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

                <main className="min-w-0 flex-1 px-4 py-8 md:pl-72 md:pr-8 lg:px-12">
                    <Outlet />
                </main>
            </div>
        </div>
    )
}
