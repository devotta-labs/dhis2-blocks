import { cn } from '@/components/dhis2/ui/cn'
import React, { type ReactNode } from 'react'
import { useHeaderContext } from '../provider/context'

export interface TrackedEntityFactsProps {
    children: ReactNode
    className?: string
}

/** The row of facts under the name. Renders nothing until the person is ready. */
export function TrackedEntityFacts({
    children,
    className,
}: TrackedEntityFactsProps) {
    const { state } = useHeaderContext()
    if (state.status !== 'ready') {
        return null
    }
    return (
        <div
            data-slot="tracked-entity-facts"
            className={cn(
                'flex flex-wrap items-center gap-x-4 gap-y-1',
                className
            )}
        >
            {children}
        </div>
    )
}
