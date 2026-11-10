import * as React from 'react'
import { cn } from './cn'

/**
 * shadcn Spinner drawn like @dhis2/ui CircularLoader: a rotating border ring.
 * Sizes follow DHIS2: size-4 border-2 (default), size-6 border-4 (small),
 * size-12 border-6 (medium).
 */
function Spinner({
    className,
    label,
    ...props
}: React.ComponentProps<'span'> & {
    /** Says what is loading; without it the spinner is decoration beside text that says so. */
    label?: string
}) {
    return (
        <span
            data-slot="spinner"
            role={label === undefined ? undefined : 'status'}
            aria-label={label}
            aria-hidden={label === undefined ? true : undefined}
            className={cn(
                'inline-block size-4 shrink-0 animate-spin rounded-full motion-reduce:animate-none border-2 border-dhis2-subtle-foreground/15 border-b-dhis2-primary forced-colors:border-b-[Highlight]',
                className
            )}
            {...props}
        />
    )
}

export { Spinner }
