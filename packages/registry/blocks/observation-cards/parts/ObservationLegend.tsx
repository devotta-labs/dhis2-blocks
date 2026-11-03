import { Badge } from '@/components/dhis2/ui/badge'
import { cn } from '@/components/dhis2/ui/cn'
import React, { type ComponentPropsWithoutRef } from 'react'
import { useObservationCard } from '../card/context'
import { legendFor, normaliseColor, readableTextColor } from '../format/display'

/** Internal: a pill with a legend or option name, coloured from its metadata. */
export function MetadataBadge({
    name,
    color,
}: {
    name: string
    color?: string
}) {
    const background = normaliseColor(color)
    if (background === undefined) {
        return (
            <Badge variant="outline" className="max-w-full">
                {name}
            </Badge>
        )
    }
    return (
        <Badge
            className="max-w-full"
            style={{
                backgroundColor: background,
                color: readableTextColor(background),
            }}
        >
            {name}
        </Badge>
    )
}

export type ObservationLegendProps = Omit<
    ComponentPropsWithoutRef<'span'>,
    'children'
>

/**
 * The legend the latest reading falls in, named and coloured from the data
 * element's legend set. Nothing when it falls in none.
 */
export function ObservationLegend({
    className,
    ...props
}: ObservationLegendProps) {
    const { series } = useObservationCard()
    // Option codes are categories, not amounts on a legend's scale.
    const legend = series.options
        ? undefined
        : legendFor(series.legends, series.latest?.numericValue)
    if (legend === undefined) {
        return null
    }
    return (
        <span
            {...props}
            data-slot="observation-legend"
            className={cn('inline-flex max-w-full', className)}
        >
            <MetadataBadge name={legend.name} color={legend.color} />
        </span>
    )
}
