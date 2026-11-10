import * as React from 'react'
import { cn } from './cn'

/** shadcn Skeleton: a pulsing grey placeholder block for loading content. */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="skeleton"
            className={cn(
                'animate-pulse rounded-dhis2-md motion-reduce:animate-none bg-dhis2-accent-strong',
                className
            )}
            {...props}
        />
    )
}

export { Skeleton }
