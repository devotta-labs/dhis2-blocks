import { cn } from '@/components/dhis2/ui/cn'
import { Collapsible } from '@base-ui/react/collapsible'
import { IconChevronRight16 } from '@dhis2/ui-icons'
import React, { type ReactNode } from 'react'

export interface SectionProps extends Omit<Collapsible.Root.Props, 'title'> {
    title: ReactNode
    /** A count or short note at the end of the title row. */
    meta?: ReactNode
    /** Drops the body's padding, for a list or table that reaches the pane's edges. */
    flush?: boolean
}

/**
 * A collapsible group inside a pane, open by default, set apart by a hairline
 * rather than space. `open` and `onOpenChange` control it.
 */
export const Section = ({
    title,
    meta,
    flush = false,
    defaultOpen = true,
    className,
    children,
    ...props
}: SectionProps) => (
    <Collapsible.Root
        {...props}
        defaultOpen={defaultOpen}
        data-slot="section"
        className={cn(
            'border-b border-dhis2-border-strong bg-dhis2-background',
            className
        )}
    >
        <h3 className="m-0 text-(length:--dhis2-text-xs) font-semibold">
            <Collapsible.Trigger className="group flex min-h-(--dhis2-row-h) w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-(--dhis2-pane-pad) text-start font-[inherit] text-(length:--dhis2-text-xs) text-dhis2-muted-foreground outline-none hover:bg-dhis2-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid">
                <span className="flex shrink-0 transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none rtl:-scale-x-100">
                    <IconChevronRight16 />
                </span>
                <span className="min-w-0 flex-1 wrap-anywhere">{title}</span>
                {meta !== undefined && (
                    <span className="shrink-0 font-normal">{meta}</span>
                )}
            </Collapsible.Trigger>
        </h3>
        <Collapsible.Panel
            className={
                flush
                    ? undefined
                    : 'px-(--dhis2-pane-pad) pb-(--dhis2-pane-pad)'
            }
        >
            {children}
        </Collapsible.Panel>
    </Collapsible.Root>
)
