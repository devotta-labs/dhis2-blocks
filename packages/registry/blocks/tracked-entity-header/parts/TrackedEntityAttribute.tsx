import React from 'react'
import { AttributeFact } from './FactPair'
import { useAttributeValue } from './useAttributeValue'

export interface TrackedEntityAttributeProps {
    /** The attribute's uid. */
    attribute: string
    /** Replaces the attribute's own label. */
    label?: string
    className?: string
}

/** One attribute of the person: its label and value, `Not recorded` or `Unavailable`. */
export function TrackedEntityAttribute({
    attribute,
    label,
    className,
}: TrackedEntityAttributeProps) {
    const state = useAttributeValue(attribute)
    return (
        <AttributeFact
            state={state}
            label={label || undefined}
            className={className}
        />
    )
}
