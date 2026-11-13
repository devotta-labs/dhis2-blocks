import { cn } from '@/components/dhis2/ui/cn'
import { Collapsible } from '@base-ui/react/collapsible'
import { IconChevronRight16 } from '@dhis2/ui-icons'
import React, { createContext, useContext, type ReactNode } from 'react'

export interface SectionProps extends Omit<Collapsible.Root.Props, 'title'> {
    title: ReactNode
    /** A count or short note at the end of the title row. */
    meta?: ReactNode
    /** Drops the body's padding, for a list or table that reaches the pane's edges. */
    flush?: boolean
    /**
     * The level of the title's heading. Left out, it is 3, under a PaneHeader's
     * 2, and one more inside another Section. Set 2 in a pane with no header.
     */
    level?: 2 | 3 | 4 | 5 | 6
}

const HEADINGS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const

/** The heading level of the Section around this one. */
const SectionLevel = createContext(2)

/**
 * A collapsible group inside a pane, open by default, set apart by a hairline
 * rather than space. `open` and `onOpenChange` control it.
 */
export const Section = ({
    title,
    meta,
    flush = false,
    defaultOpen = true,
    level,
    className,
    children,
    ...props
}: SectionProps) => {
    const outer = useContext(SectionLevel)
    const own = level ?? Math.min(outer + 1, 6)
    const Heading = HEADINGS[own - 2] ?? 'h6'
    return (
        <Collapsible.Root
            {...props}
            defaultOpen={defaultOpen}
            data-slot="section"
            className={cn(
                'border-b border-dhis2-border-strong bg-dhis2-background',
                className
            )}
        >
            <Heading className="m-0 text-(length:--dhis2-text-xs) font-semibold">
                <Collapsible.Trigger className="group flex min-h-(--dhis2-row-h) w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-(--dhis2-pane-pad) text-start font-[inherit] text-(length:--dhis2-text-xs) text-dhis2-muted-foreground outline-none hover:bg-dhis2-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid">
                    <span className="flex shrink-0 transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none rtl:-scale-x-100">
                        <IconChevronRight16 />
                    </span>
                    <span className="min-w-0 flex-1 wrap-anywhere">
                        {title}
                    </span>
                    {meta !== undefined && (
                        <span className="shrink-0 font-normal">{meta}</span>
                    )}
                </Collapsible.Trigger>
            </Heading>
            <Collapsible.Panel
                className={
                    flush
                        ? undefined
                        : 'px-(--dhis2-pane-pad) pb-(--dhis2-pane-pad)'
                }
            >
                <SectionLevel.Provider value={own}>
                    {children}
                </SectionLevel.Provider>
            </Collapsible.Panel>
        </Collapsible.Root>
    )
}
