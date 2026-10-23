import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { useFinderPerson, useFinderResults } from '../hooks'
import { useFinderContext } from '../provider/context'
import { FinderValue } from './FinderValue'

export type FinderItemProps = Omit<ComponentPropsWithoutRef<'button'>, 'type'>

/** The program's displayInList attributes, in metadata order. */
const ListedValues = () => {
    const { state } = useFinderContext()
    const listed = state.model?.attributes.filter(
        ({ displayInList }) => displayInList
    )
    return (
        <span className="flex flex-wrap gap-x-4 gap-y-1">
            {listed?.map(({ id, label }) => (
                <span key={id} className="flex flex-col">
                    <span className="text-xs text-dhis2-grey-700">{label}</span>
                    <FinderValue
                        attribute={id}
                        className="text-dhis2-grey-900"
                    />
                </span>
            ))}
        </span>
    )
}

/**
 * The selectable row for the current person; calls `onSelect`. Without
 * children it shows the program's displayInList attributes.
 */
export function FinderItem({
    className,
    children,
    onClick,
    ...props
}: FinderItemProps) {
    const person = useFinderPerson()
    const { select } = useFinderResults()
    return (
        <button
            {...props}
            type="button"
            data-slot="finder-item"
            className={cn(
                'w-full cursor-pointer rounded-dhis2-sm border border-dhis2-grey-300 bg-white px-3 py-2 text-left text-sm hover:bg-dhis2-grey-100 focus-visible:outline-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid',
                className
            )}
            onClick={(event) => {
                onClick?.(event)
                if (!event.defaultPrevented) {
                    select(person)
                }
            }}
        >
            {children ?? <ListedValues />}
        </button>
    )
}
