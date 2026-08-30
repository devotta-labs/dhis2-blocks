import React, { type ReactNode } from 'react'
import { useShowcaseContext, type ShowcaseContext } from './useShowcaseContext'

export interface ShowcaseTheme {
    /** Full-page background and base text colours. */
    page: string
    /** Small label above the title. */
    kicker: string
    title: string
    tagline: string
    /** Route navigation container and its two link states. */
    nav: string
    navActive: string
    navIdle: string
    /** Program / organisation unit picker chrome. */
    picker: string
    select: string
    status: string
}

export interface ShowcaseLayoutProps {
    theme: ShowcaseTheme
    kicker: string
    title: string
    tagline: string
    currentPath: ShowcaseRoutePath
    children(context: { programId: string; orgUnitId: string }): ReactNode
}

export type ShowcaseRoutePath = '/aurora' | '/terminal' | '/editorial'

const routes: Array<{ path: ShowcaseRoutePath; label: string }> = [
    { path: '/aurora', label: 'Aurora' },
    { path: '/terminal', label: 'Terminal' },
    { path: '/editorial', label: 'Editorial' },
]

const ContextPickers = ({
    context,
    theme,
}: {
    context: ShowcaseContext
    theme: ShowcaseTheme
}) => (
    <div className={theme.picker} data-testid="showcase-context-pickers">
        <label className="inline-flex items-center gap-2">
            <span>Program</span>
            <select
                className={theme.select}
                data-testid="showcase-program-select"
                value={context.programId ?? ''}
                onChange={(event) =>
                    context.selectProgram(event.currentTarget.value)
                }
            >
                {context.programs.map((program) => (
                    <option key={program.id} value={program.id}>
                        {program.displayName}
                    </option>
                ))}
            </select>
        </label>
        <label className="inline-flex items-center gap-2">
            <span>Organisation unit</span>
            <select
                className={theme.select}
                data-testid="showcase-org-unit-select"
                value={context.orgUnitId ?? ''}
                onChange={(event) =>
                    context.selectOrgUnit(event.currentTarget.value)
                }
            >
                {context.organisationUnits.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                        {unit.displayName}
                    </option>
                ))}
            </select>
        </label>
    </div>
)

export const ShowcaseLayout = ({
    theme,
    kicker,
    title,
    tagline,
    currentPath,
    children,
}: ShowcaseLayoutProps) => {
    const context = useShowcaseContext()

    return (
        <div
            className={`flex min-h-screen w-full min-w-0 flex-col ${theme.page}`}
            data-testid="working-list-showcase"
        >
            <header className="mx-auto flex w-full max-w-[1600px] flex-wrap items-end justify-between gap-4 px-8 pt-8 pb-4 [@media(max-width:900px)]:px-4">
                <div className="min-w-0">
                    <p className={`m-0 ${theme.kicker}`}>{kicker}</p>
                    <h1 className={`m-0 ${theme.title}`}>{title}</h1>
                    <p className={`m-0 ${theme.tagline}`}>{tagline}</p>
                </div>
                <nav className={theme.nav} aria-label="Working list variants">
                    {routes.map((route) => (
                        <a
                            key={route.path}
                            href={`#${route.path}`}
                            aria-current={
                                route.path === currentPath ? 'page' : undefined
                            }
                            className={
                                route.path === currentPath
                                    ? theme.navActive
                                    : theme.navIdle
                            }
                            data-testid={`showcase-nav-${route.label.toLowerCase()}`}
                        >
                            {route.label}
                        </a>
                    ))}
                    <a href="#/" className={theme.navIdle}>
                        App shell
                    </a>
                </nav>
            </header>

            <main
                className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 px-8 pb-10 [@media(max-width:900px)]:px-4"
                data-testid="showcase-layout"
            >
                <ContextPickers context={context} theme={theme} />
                {context.errorMessage && (
                    <p className={theme.status} role="alert">
                        {context.errorMessage}
                    </p>
                )}
                {!context.errorMessage && context.loading && (
                    <p className={theme.status}>Loading DHIS2 context…</p>
                )}
                {!context.errorMessage &&
                    !context.loading &&
                    (!context.programId || !context.orgUnitId) && (
                        <p className={theme.status}>
                            No accessible tracker program with organisation
                            units was found.
                        </p>
                    )}
                {context.programId && context.orgUnitId && (
                    <div className="flex min-h-0 flex-1 flex-col">
                        {children({
                            programId: context.programId,
                            orgUnitId: context.orgUnitId,
                        })}
                    </div>
                )}
            </main>
        </div>
    )
}
