import React, { type ComponentPropsWithoutRef } from 'react'
import { useObservationCard } from '../card/context'
import { CardHeading } from '../card/frame'

export type ObservationLabelProps = Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
>

/** The card's label, or the data element's own name, as its heading. */
export function ObservationLabel(props: ObservationLabelProps) {
    const { title } = useObservationCard()
    return <CardHeading {...props}>{title}</CardHeading>
}
