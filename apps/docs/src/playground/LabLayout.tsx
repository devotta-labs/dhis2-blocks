import { useContext, useState, type ReactNode } from 'react'
import { LabPicker } from './labPicker'
import './lab.css'

/** A card's heading row, as the docs' example cards have. */
const cardHeader =
    'm-0 flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 text-sm font-medium text-foreground'

const Chevron = ({ open }: { open: boolean }) => (
    <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={`size-3.5 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="m6 3.5 4.5 4.5L6 12.5" />
    </svg>
)

/**
 * The page every lab shares, in the docs' own look: a settings rail of the playground's block picker and the lab's
 * own controls, the block under test on a dotted canvas, and an optional panel underneath, folded until opened. On a
 * phone the controls fold away above the block. The controls take their dress from `lab.css`; the block keeps its own.
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
        <div className="lab flex h-full flex-col bg-background md:flex-row">
            <aside
                className={`lab-chrome flex shrink-0 flex-col border-b border-border bg-background md:max-h-none md:w-80 md:border-e md:border-b-0 ${controls ? 'max-h-[60%]' : ''}`}
            >
                <div className="flex h-12 shrink-0 items-center gap-2 px-4 md:h-14">
                    <h1 className="m-0 text-sm font-semibold text-foreground">
                        Settings
                    </h1>
                    <button
                        type="button"
                        aria-expanded={controls}
                        className="ms-auto md:hidden"
                        onClick={() => setControls((was) => !was)}
                    >
                        {controls ? 'Hide' : 'Show'}
                    </button>
                </div>
                <div
                    className={`min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4 md:flex ${controls ? 'flex' : 'hidden'}`}
                >
                    {picker}
                    {sidebar}
                </div>
            </aside>
            <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 bg-muted/40 p-2 md:p-4">
                <section
                    aria-label="Canvas"
                    className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card"
                >
                    <h2 className={cardHeader}>Canvas</h2>
                    {/* Relative, so the block's absolutely placed parts scroll with the canvas rather than widen the page. */}
                    <div className="lab-graticule relative flex min-h-0 flex-1 flex-col overflow-auto">
                        <div className="flex flex-col gap-3 p-3 [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900 [color-scheme:light] md:p-6">
                            {children}
                        </div>
                    </div>
                </section>
                {panel && (
                    <section
                        aria-label={panel.title}
                        className={`lab-chrome flex shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-card ${open ? 'h-[38%]' : ''}`}
                    >
                        <button
                            type="button"
                            aria-expanded={open}
                            className={`${cardHeader} min-h-10 w-full rounded-none border-x-0 border-t-0 bg-transparent text-start text-sm ${open ? '' : 'border-b-0'}`}
                            onClick={() => setOpen((was) => !was)}
                        >
                            <Chevron open={open} />
                            {panel.title}
                            <span className="ms-auto text-xs font-normal text-muted-foreground">
                                {open ? 'Hide' : 'Show'}
                            </span>
                        </button>
                        {open && (
                            <div className="min-h-0 flex-1 overflow-hidden font-mono">
                                {panel.children}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </div>
    )
}
