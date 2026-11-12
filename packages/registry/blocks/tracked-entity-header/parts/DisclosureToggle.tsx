import { cn } from '@/components/dhis2/ui/cn'
import { IconChevronRight16 } from '@dhis2/ui-icons'
import React from 'react'

/**
 * The button that opens a part's panel: a chevron, the label and, when
 * known, how many rows the panel holds. A banner lines these up on one row.
 */
export const DisclosureToggle = ({
    label,
    count,
    open,
    controls,
    onToggle,
    className,
}: {
    label: string
    count?: number
    open: boolean
    controls: string
    onToggle: () => void
    className?: string
}) => (
    <button
        type="button"
        data-slot="tracked-entity-toggle"
        aria-expanded={open}
        aria-controls={controls}
        onClick={onToggle}
        className={cn(
            // The ring sits inside: the toggle reaches the row's clipped edge.
            'group inline-flex cursor-pointer items-center gap-1 self-center -mx-1.5 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-sm text-dhis2-foreground hover:bg-dhis2-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-dhis2-ring focus-visible:outline-solid',
            className
        )}
    >
        <span
            aria-hidden="true"
            className="flex text-dhis2-muted-foreground transition-transform duration-100 group-aria-expanded:rotate-90 motion-reduce:transition-none rtl:-scale-x-100 rtl:group-aria-expanded:-rotate-90"
        >
            <IconChevronRight16 />
        </span>
        {label}
        {count !== undefined && (
            <>
                {/* Spoken as "Related 5"; the gap draws the space. */}{' '}
                <span
                    data-slot="tracked-entity-toggle-count"
                    className="ms-0.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-dhis2-foreground/8 px-1.5 text-xs leading-none font-medium tabular-nums text-dhis2-foreground"
                >
                    {count}
                </span>
            </>
        )}
    </button>
)
