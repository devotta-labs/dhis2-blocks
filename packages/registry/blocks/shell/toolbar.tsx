import { cn } from '@/components/dhis2/ui/cn'
import { Toolbar as ToolbarPrimitive } from '@base-ui/react/toolbar'
import React from 'react'
import { BAR_HEIGHT } from './density'

/**
 * A row of borderless buttons and dividers, with at most one primary button.
 * Arrow keys move between its buttons. Name it with `aria-label`.
 */
export const Toolbar = ({
    className,
    ...props
}: ToolbarPrimitive.Root.Props) => (
    <ToolbarPrimitive.Root
        {...props}
        data-slot="toolbar"
        className={cn(
            BAR_HEIGHT,
            'flex shrink-0 flex-wrap items-center gap-0.5 border-b border-dhis2-border-strong bg-dhis2-background px-(--dhis2-pane-pad) text-(length:--dhis2-text)',
            className
        )}
    />
)

export interface ToolbarButtonProps extends ToolbarPrimitive.Button.Props {
    /** The toolbar's one filled button. */
    primary?: boolean
}

export const ToolbarButton = ({
    primary = false,
    className,
    ...props
}: ToolbarButtonProps) => (
    <ToolbarPrimitive.Button
        {...props}
        data-slot="toolbar-button"
        data-primary={primary || undefined}
        className={cn(
            "inline-flex h-(--dhis2-control-h) shrink-0 cursor-pointer items-center gap-1.5 rounded-dhis2-sm border-0 px-(--dhis2-pane-pad) text-(length:--dhis2-text) whitespace-nowrap outline-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-solid data-disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
            primary
                ? 'bg-dhis2-primary font-medium text-dhis2-primary-foreground hover:bg-dhis2-primary-strong focus-visible:-outline-offset-5 focus-visible:outline-dhis2-primary-foreground data-disabled:bg-dhis2-accent-strong data-disabled:text-dhis2-disabled-foreground'
                : 'bg-transparent text-dhis2-foreground hover:bg-dhis2-accent focus-visible:outline-dhis2-ring data-disabled:text-dhis2-disabled-foreground',
            className
        )}
    />
)

export const ToolbarDivider = ({
    className,
    ...props
}: ToolbarPrimitive.Separator.Props) => (
    <ToolbarPrimitive.Separator
        {...props}
        data-slot="toolbar-divider"
        className={cn(
            'mx-1 my-1 w-px self-stretch bg-dhis2-border-strong',
            className
        )}
    />
)

/** Pushes what follows it to the toolbar's end. */
export const ToolbarSpacer = () => <div className="flex-1" />
