import * as React from 'react'
import { cn } from './cn'

/** shadcn Skeleton: a pulsing grey placeholder block for loading content. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                'animate-pulse rounded-dhis2-md bg-dhis2-grey-300',
                className
            )}
            {...props}
        />
    )
}

export { Skeleton }
