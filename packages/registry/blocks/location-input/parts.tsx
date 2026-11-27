import type { ReactNode } from 'react'
import { FieldDescription } from '@/components/dhis2/ui/field'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import type { Note } from './notes'

/** A button inside the field: an icon, named, larger on touch. */
export const FIELD_BUTTON =
    'size-8 text-dhis2-subtle-foreground hover:text-dhis2-foreground pointer-coarse:size-10'

/** A press that keeps focus where it is, so half-typed text is not committed. */
export const keepFocus = (event: { preventDefault: () => void }) =>
    event.preventDefault()

/** The quiet line under the field: muted, or a warning marked by its icon and colour together. */
export const Notes = ({ notes }: { notes: readonly Note[] }) => {
    if (notes.length === 0) return null
    const warning = notes.some(({ tone }) => tone === 'warning')
    return (
        <FieldDescription
            className={
                warning
                    ? 'flex items-start gap-1.5 text-dhis2-warning-strong'
                    : 'tabular-nums'
            }
        >
            {warning ? (
                <span className="mt-0.5 shrink-0">
                    <IconWarningFilled16 />
                </span>
            ) : null}
            <span>{notes.map(({ text }) => text).join(' · ')}</span>
        </FieldDescription>
    )
}

/** A panel's footer: what is recorded in words on the left, actions on the right. */
export const PanelFooter = ({
    summary,
    children,
}: {
    summary: string
    children: ReactNode
}) => (
    <div className="flex flex-wrap items-center gap-2 px-1 pt-2">
        <p className="m-0 min-w-0 flex-1 truncate text-xs text-dhis2-muted-foreground tabular-nums">
            {summary}
        </p>
        <div className="flex items-center gap-1.5 max-sm:w-full max-sm:justify-end">
            {children}
        </div>
    </div>
)
