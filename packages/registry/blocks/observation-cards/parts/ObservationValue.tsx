import { cn } from '@/components/dhis2/ui/cn'
import React from 'react'
import { useObservationCard } from '../card/context'
import { formatPointValue, isUnticked } from '../format/display'
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
                {/* The value's own size, wrapping rather than clipping a long name; the radius keeps one line a pill. */}
                <MetadataBadge
                    name={text}
                    color={color}
                    className="h-auto min-h-7 rounded-[14px] px-2.5 py-1 text-sm leading-5 break-words whitespace-normal"
                />
            </p>
        )
    }

    const shownUnit =
        latest.numericValue === undefined ? undefined : (unit ?? cardUnit)
    return (
        <p
            data-slot="observation-value"
            className={cn(
                'flex min-w-0 flex-wrap items-baseline gap-x-1 gap-y-1',
                className
            )}
        >
            <span
                data-slot="value-text"
                className={cn(
                    TEXT_TYPES.has(series.valueType)
                        ? 'line-clamp-3 min-w-0 text-base [overflow-wrap:anywhere]'
                        : 'min-w-0 text-3xl leading-none font-semibold tabular-nums [overflow-wrap:anywhere]',
                    // Greyed, so an empty box never reads as a finding.
                    isUnticked(series, latest) && 'text-dhis2-subtle-foreground'
                )}
            >
                {text}
            </span>
            {shownUnit ? (
                <span
                    data-slot="value-unit"
                    className="text-sm text-dhis2-muted-foreground"
                >
                    {shownUnit}
                </span>
            ) : null}
        </p>
    )
}
