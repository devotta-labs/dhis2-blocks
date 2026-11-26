import React, { type ComponentProps } from 'react'
import { cn } from '@/components/dhis2/ui/cn'

/** Puts a dot between parts; an empty part renders nothing and drops out. */
export const META_SEPARATORS =
    "[&>*:not(:last-child)]:after:inline-block [&>*:not(:last-child)]:after:ps-1.5 [&>*:not(:last-child)]:after:text-dhis2-muted-foreground [&>*:not(:last-child)]:after:content-['·']"

/**
 * A muted line of short facts, such as the place, the health worker and the
 * time, with a dot between each child. Hidden when every child is empty.
 */
export const VisitMeta = ({ className, ...props }: ComponentProps<'div'>) => (
    <div
        data-slot="visit-meta"
        className={cn(
            'flex flex-wrap items-baseline gap-x-1.5 text-sm text-dhis2-muted-foreground empty:hidden',
            META_SEPARATORS,
            className
        )}
        {...props}
    />
)
