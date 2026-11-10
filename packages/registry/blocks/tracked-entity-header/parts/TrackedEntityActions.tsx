import { cn } from '@/components/dhis2/ui/cn'
import React, { type ReactNode } from 'react'

export interface TrackedEntityActionsProps {
    children: ReactNode
    className?: string
}

/** Where the caller's buttons go. Always renders, whatever state the person is in. */
export function TrackedEntityActions({
    children,
    className,
}: TrackedEntityActionsProps) {
    return (
        <div
            data-slot="tracked-entity-actions"
            className={cn('flex flex-wrap items-center gap-2', className)}
        >
            {children}
        </div>
    )
}
