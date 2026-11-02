import { useState, type ReactNode } from 'react'
import './lab.css'

const paneTitle =
    'm-0 flex min-h-6 items-center gap-2 bg-(--lab-ink) px-2 text-[11px] font-normal tracking-[0.1em] text-(--lab-paper)'

/**
 * The page every lab shares: a sidebar of the lab's own controls, the block under test on its scope, and an optional
 * panel that splits the main view underneath. The panes are the lab's instrument chrome (see `lab.css`); the block
 * keeps its own look.
 */
export const LabLayout = ({
    title,
    sidebar,
    status,
    panel,
    children,
}: {
    title: string
    sidebar: ReactNode
    /** One line of readouts above the block. */
    status?: ReactNode
    panel?: { title: string; children: ReactNode }
    children: ReactNode
}) => {
    const [open, setOpen] = useState(true)

    return (
        <div className="lab flex h-screen gap-1.5 bg-(--lab-desk) p-1.5">
            <aside className="lab-chrome flex w-[22rem] shrink-0 flex-col bg-(--lab-paper)">
                <h1 className={`${paneTitle} uppercase`}>
                    <span aria-hidden="true">■</span>
                    {title}
                </h1>
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2.5">
                    {sidebar}
                </div>
            </aside>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <main className="lab-graticule flex min-h-0 flex-1 flex-col overflow-auto">
                    {status && (
                        <div
                            className={`lab-chrome sticky top-0 z-10 shrink-0 ${paneTitle}`}
                        >
                            {status}
                        </div>
                    )}
                    <div className="flex flex-col gap-3 p-4 [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900">
                        {children}
                    </div>
                </main>
                {panel && (
                    <section
                        aria-label={panel.title}
                        className={`lab-chrome flex shrink-0 flex-col bg-(--lab-paper) ${open ? 'h-[38%]' : ''}`}
                    >
                        <button
                            type="button"
                            aria-expanded={open}
                            className={`${paneTitle} w-full border-0 text-start uppercase hover:bg-(--lab-ink-2)`}
                            onClick={() => setOpen((was) => !was)}
                        >
                            <span aria-hidden="true">{open ? '▾' : '▸'}</span>
                            {panel.title}
                            <span className="ms-auto text-(--lab-ink-4)">
                                {open ? 'hide' : 'show'}
                            </span>
                        </button>
                        {open && (
                            <div className="min-h-0 flex-1 overflow-hidden">
                                {panel.children}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    )
}
