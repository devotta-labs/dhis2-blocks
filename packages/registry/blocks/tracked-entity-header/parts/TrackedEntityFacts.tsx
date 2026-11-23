import { cn } from '@/components/dhis2/ui/cn'
import React, { type ReactNode } from 'react'
import { useHeaderContext } from '../provider/context'
import { DIVIDED } from './divided'

export interface TrackedEntityFactsProps {
    children: ReactNode
    className?: string
}

/** The row of facts under the name. Renders nothing until the record is ready. */
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
                'flex flex-wrap items-baseline gap-y-1',
                DIVIDED,
                className
            )}
        >
            {children}
        </div>
    )
}
