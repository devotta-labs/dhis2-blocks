import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useFinderResults } from '../hooks'
import { FinderPersonContext } from '../provider/context'

export type FinderListProps = ComponentPropsWithoutRef<'ul'>

/**
 * Renders its children once per person on the current page, each in an
 * `<li>` where `useFinderPerson` reads that person. Renders nothing unless
 * there are results.
 */
export function FinderList({ className, children, ...props }: FinderListProps) {
    const { status, people, refreshing } = useFinderResults()
    if (status !== 'results') {
        return null
    }
    return (
        <ul
            aria-busy={refreshing}
            {...props}
            data-slot="finder-list"
            className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}
        >
            {people.map((person) => (
                <li key={person.trackedEntity}>
                    <FinderPersonContext.Provider value={person}>
                        {children}
                    </FinderPersonContext.Provider>
                </li>
            ))}
        </ul>
    )
}
