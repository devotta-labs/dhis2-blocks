import { cn } from '@/components/dhis2/ui/cn'
import { Collapsible } from '@base-ui/react/collapsible'
import { IconChevronRight16 } from '@dhis2/ui-icons'
import React, { createContext, useContext, type ReactNode } from 'react'

export interface SectionProps extends Omit<Collapsible.Root.Props, 'title'> {
    /** The title, with `children` as the body. */
    title?: ReactNode
    /** With a `title`: a count or short note at the end of its row. */
    meta?: ReactNode
    /** With a `title`: drops the body's padding, as SectionContent's `flush` does. */
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
 * The row that opens and closes a Section: a heading holding a button, with
 * an arrow before whatever it is given, such as a title and a count.
 */
export const SectionTrigger = ({
    className,
    children,
    ...props
}: Collapsible.Trigger.Props) => {
    const level = useContext(SectionLevel)
    const Heading = HEADINGS[level - 2] ?? 'h6'
    return (
        <Heading
            data-slot="section-heading"
            className="m-0 text-(length:--dhis2-text-xs) font-semibold"
        >
            <Collapsible.Trigger
                {...props}
                data-slot="section-trigger"
                className={cn(
                    'group flex min-h-(--dhis2-row-h) w-full cursor-pointer items-center gap-1.5 border-0 bg-transparent px-(--dhis2-pane-pad) text-start font-[inherit] text-(length:--dhis2-text-xs) text-dhis2-muted-foreground outline-none hover:bg-dhis2-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid',
                    className
                )}
            >
                <span
                    data-slot="section-indicator"
                    className="flex shrink-0 transition-transform group-data-panel-open:rotate-90 motion-reduce:transition-none rtl:-scale-x-100"
                >
                    <IconChevronRight16 />
                </span>
                {children}
            </Collapsible.Trigger>
        </Heading>
    )
}

export interface SectionContentProps extends Collapsible.Panel.Props {
    /** Drops the padding, for a list or table that reaches the pane's edges. */
    flush?: boolean
}

/** The part of a Section that opens and closes. */
export const SectionContent = ({
    flush = false,
    className,
    ...props
}: SectionContentProps) => (
    <Collapsible.Panel
        {...props}
        data-slot="section-content"
        className={cn(
            !flush && 'px-(--dhis2-pane-pad) pb-(--dhis2-pane-pad)',
            className
        )}
    />
)

/**
 * A collapsible group inside a pane, open by default, set apart by a hairline
 * rather than space. Give it a `title`, with the body as children; or leave
 * `title` out and compose it from a SectionTrigger and a SectionContent.
 * `open` and `onOpenChange` control it.
 */
export const Section = ({
    title,
    meta,
    flush,
    defaultOpen = true,
    level,
    className,
    children,
    ...props
}: SectionProps) => {
    const outer = useContext(SectionLevel)
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
            <SectionLevel.Provider value={level ?? Math.min(outer + 1, 6)}>
                {title === undefined ? (
                    children
                ) : (
                    <>
                        <SectionTrigger>
                            <span
                                data-slot="section-title"
                                className="min-w-0 flex-1 wrap-anywhere"
                            >
                                {title}
                            </span>
                            {meta !== undefined && (
                                <span
                                    data-slot="section-meta"
                                    className="shrink-0 font-normal"
                                >
                                    {meta}
                                </span>
                            )}
                        </SectionTrigger>
                        <SectionContent flush={flush}>
                            {children}
                        </SectionContent>
                    </>
                )}
            </SectionLevel.Provider>
        </Collapsible.Root>
    )
}
