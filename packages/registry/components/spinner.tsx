import * as React from 'react'
import { cn } from './cn'

/**
 * shadcn Spinner drawn like @dhis2/ui CircularLoader: a rotating border ring.
 * Sizes follow DHIS2: size-4 border-2 (default), size-6 border-4 (small),
 * size-12 border-6 (medium).
 */
function Spinner({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="spinner"
            role="status"
            aria-label="Loading"
            className={cn(
                'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-dhis2-grey-600/15 border-b-dhis2-blue-600',
                className
            )}
            {...props}
        />
    )
}

export { Spinner }
