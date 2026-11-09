import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { FinderItem } from './FinderItem'
import { FinderList } from './FinderList'
import { FinderPagination } from './FinderPagination'
import {
    FinderEmpty,
    FinderError,
    FinderSearching,
    FinderTooMany,
} from './FinderStates'

export type FinderResultsProps = ComponentPropsWithoutRef<'div'>

/**
 * The results region for the last submitted search. Without children it
 * renders the default composition; with children, only the children.
 */
export function FinderResults({
    className,
    children,
    ...props
}: FinderResultsProps) {
    return (
        <div
            {...props}
            data-slot="finder-results"
            className={cn('flex flex-col gap-3', className)}
        >
            {children ?? (
                <>
                    <FinderSearching />
                    <FinderEmpty />
                    <FinderTooMany />
                    <FinderError />
                    <FinderList>
                        <FinderItem />
                    </FinderList>
                    <FinderPagination />
                </>
            )}
        </div>
    )
}
