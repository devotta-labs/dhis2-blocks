import { useContext, useState, type ReactNode } from 'react'
import { LabPicker } from './labPicker'
import './lab.css'

const paneTitle =
    'm-0 flex min-h-6 items-center gap-2 bg-(--lab-bar) px-2 text-[11px] font-normal tracking-[0.1em] text-(--lab-bar-ink)'

/**
 * The page every lab shares: a settings sidebar of the playground's block picker and the lab's own controls, the
 * block under test on its canvas, and an optional panel underneath, folded until opened. On a phone the controls
 * fold away above the block. The panes are the lab's instrument chrome (see `lab.css`); the block keeps its own look.
 */
export const LabLayout = ({
    sidebar,
    panel,
    children,
}: {
    sidebar: ReactNode
    panel?: { title: string; children: ReactNode }
    children: ReactNode
}) => {
    const picker = useContext(LabPicker)
    const [open, setOpen] = useState(false)
    const [controls, setControls] = useState(false)

    return (
        <div className="lab flex h-full flex-col gap-1.5 bg-(--lab-desk) p-1.5 md:flex-row">
            <aside
                className={`lab-chrome flex shrink-0 flex-col bg-(--lab-paper) md:max-h-none md:w-[22rem] ${controls ? 'max-h-[60%]' : ''}`}
            >
                <div className={`${paneTitle} uppercase`}>
                    <span aria-hidden="true">■</span>
                    Settings
                    <button
                        type="button"
                        aria-expanded={controls}
                        className="ms-auto min-h-[18px] border-current px-1.5 text-[10.5px] text-(--lab-bar-ink) hover:bg-transparent md:hidden"
                        onClick={() => setControls((was) => !was)}
                    >
                        {controls ? 'Hide controls' : 'Controls'}
                    </button>
                </div>
                <div
                    className={`min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-2.5 md:flex ${controls ? 'flex' : 'hidden'}`}
                >
                    {picker}
                    {sidebar}
                </div>
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1.5">
                {/* Relative, so the block's absolutely placed parts scroll with the canvas rather than widen the page. */}
                <main className="lab-graticule relative flex min-h-0 flex-1 flex-col overflow-auto">
                    <div
                        className={`lab-chrome sticky top-0 z-10 shrink-0 ${paneTitle} uppercase`}
                    >
                        Canvas
                    </div>
                    <div className="flex flex-col gap-3 p-2 [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900 [color-scheme:light] md:p-4">
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
                            className={`${paneTitle} w-full border-0 text-start uppercase hover:bg-(--lab-bar-hover)`}
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
