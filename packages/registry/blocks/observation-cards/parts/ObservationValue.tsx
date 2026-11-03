import { cn } from '@/components/dhis2/ui/cn'
import React from 'react'
import { useObservationCard } from '../card/context'
import { formatPointValue } from '../format/display'
import { MetadataBadge } from './ObservationLegend'

export interface ObservationValueProps {
    /** Shown after a number, such as `kg`; the card's `unit` otherwise. */
    unit?: string
    className?: string
}

const TEXT_TYPES = new Set(['TEXT', 'LONG_TEXT'])

/**
 * The latest reading: a number with its unit, an option in its colour, Yes or
 * No, a date in the system calendar, or text.
 */
export function ObservationValue({ unit, className }: ObservationValueProps) {
    const { series, unit: cardUnit, display } = useObservationCard()
    const latest = series.latest
    if (latest === undefined) {
        return null
    }
    const text = formatPointValue(series, latest, display)

    if (series.options) {
        const color = series.options.find(
            (option) => option.code === latest.value
        )?.color
        return (
            <p
                data-slot="observation-value"
                className={cn('flex min-w-0', className)}
            >
                <MetadataBadge name={text} color={color} />
            </p>
        )
    }

    const shownUnit =
        latest.numericValue === undefined ? undefined : (unit ?? cardUnit)
    return (
        <p
            data-slot="observation-value"
            className={cn(
                'flex min-w-0 flex-wrap items-baseline gap-x-1',
                className
            )}
        >
            <span
                data-slot="value-text"
                className={
                    TEXT_TYPES.has(series.valueType)
                        ? 'line-clamp-3 min-w-0 text-base [overflow-wrap:anywhere]'
                        : 'min-w-0 text-3xl leading-none font-semibold tabular-nums [overflow-wrap:anywhere]'
                }
            >
                {text}
            </span>
            {shownUnit ? (
                <span
                    data-slot="value-unit"
                    className="text-sm text-dhis2-grey-700"
                >
                    {shownUnit}
                </span>
            ) : null}
        </p>
    )
}
