import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { formatValue } from '../format/formatValue'
import { useFinderPerson } from '../hooks'
import { useFinderModel } from '../provider/useFinderModel'
import { attributeOf } from '../rules/programModel'

export interface FinderValueProps extends Omit<
    ComponentPropsWithoutRef<'span'>,
    'children'
> {
    /** The attribute uid; any attribute the API returned can be shown. */
    attribute: string
}

/**
 * One value of the current person, formatted by its value type. A uid
 * outside the program's attributes shows the raw value.
 */
export function FinderValue({
    attribute,
    className,
    ...props
}: FinderValueProps) {
    const { model, info } = useFinderModel()
    const person = useFinderPerson()
    const raw = Object.hasOwn(person.attributes, attribute)
        ? person.attributes[attribute]
        : ''
    const found = model ? attributeOf(model, attribute) : undefined
    return (
        <span {...props} data-slot="finder-value" className={cn(className)}>
            {info ? formatValue(found, raw, info) : raw}
        </span>
    )
}
