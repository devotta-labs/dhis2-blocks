import i18n from '@dhis2/d2-i18n'
import { IconArrowDown16, IconArrowUp16 } from '@dhis2/ui-icons'
import React from 'react'
import type {
    ObservationResult,
    ObservationSeries,
} from '../use-tracked-entity-observations'
import { LegendBadge } from './LegendBadge'
import { ObservationCardFrame, PartialNote } from './ObservationCardFrame'
import { RecordedNote } from './RecordedNote'
import { Sparkline } from './Sparkline'
import { useFormatDate } from './calendar'
import {
    NO_ESCAPE,
    displayValue,
    formatNumber,
    isTrendType,
    legendFor,
} from './format'

export interface TrendCardProps {
    observation: ObservationResult
    /** Shown after the value, such as `kg`. */
    unit?: string
    /** Overrides the data element's own label. */
    label?: string
    /** The most recent readings the sparkline plots. */
    maxPoints?: number
    className?: string
}

interface ChangeLine {
    /** An arrow shown to sighted users and the word a screen reader says instead. */
    direction?: { Arrow: typeof IconArrowUp16; word: string }
    text: string
}

/** The change from the previous reading, or nothing when there is no earlier one. */
const changeLine = (
    series: ObservationSeries,
    unit: string | undefined,
    formatDate: (iso: string) => string
): ChangeLine | undefined => {
    const { change, previous } = series
    if (change === undefined || previous === undefined) {
        return undefined
    }
    const date = formatDate(previous.occurredAt)
    // A change that rounds to nothing would otherwise read "↑ 0".
    if (Math.round(change * 100) === 0) {
        return {
            text: i18n.t('No change since {{date}}', {
                date,
                interpolation: NO_ESCAPE,
            }),
        }
    }
    return {
        direction:
            change > 0
                ? { Arrow: IconArrowUp16, word: i18n.t('up') }
                : { Arrow: IconArrowDown16, word: i18n.t('down') },
        text: i18n.t('{{change}} since {{date}}', {
            change: [formatNumber(Math.abs(change)), unit]
                .filter(Boolean)
                .join(' '),
            date,
            interpolation: NO_ESCAPE,
        }),
    }
}

/** A numeric observation: latest value, legend, change since the previous reading and a sparkline. */
export function TrendCard({
    observation,
    unit,
    label,
    maxPoints,
    className,
}: TrendCardProps) {
    const formatDate = useFormatDate()

    if (observation.status === 'pending') {
        return (
            <ObservationCardFrame
                label={label}
                state="pending"
                skeleton="trend"
                className={className}
            />
        )
    }
    if (observation.status === 'error') {
        return (
            <ObservationCardFrame
                label={label}
                state="error"
                className={className}
            />
        )
    }

    const { series } = observation
    const title = label ?? series.label
    const partialNote = series.partial ? <PartialNote /> : undefined

    if (!isTrendType(series.valueType)) {
        return (
            <ObservationCardFrame
                label={title}
                footer={partialNote}
                className={className}
            >
                <p className="text-sm text-dhis2-grey-700">
                    {i18n.t("This value type can't be shown as a trend")}
                </p>
            </ObservationCardFrame>
        )
    }

    const latest = series.latest
    if (latest === undefined) {
        return (
            <ObservationCardFrame
                label={title}
                state="empty"
                footer={partialNote}
                className={className}
            />
        )
    }

    const legend =
        latest.numericValue === undefined
            ? undefined
            : legendFor(series.legends, latest.numericValue)
    const change = changeLine(series, unit, formatDate)
    // One reading has no trend: a lone dot would read as a glitch.
    const plottable =
        series.points.filter((point) => point.numericValue !== undefined)
            .length > 1

    return (
        <ObservationCardFrame
            label={title}
            badge={<LegendBadge legend={legend} option={undefined} />}
            footer={
                <>
                    <RecordedNote point={latest} />
                    {partialNote}
                </>
            }
            className={className}
        >
            <p className="flex items-baseline gap-1">
                <span className="text-3xl leading-none font-semibold">
                    {displayValue(series, latest, formatDate)}
                </span>
                {unit ? (
                    <span className="text-sm text-dhis2-grey-700">{unit}</span>
                ) : null}
            </p>
            {change ? (
                <p className="text-sm text-dhis2-grey-700">
                    {change.direction ? (
                        <>
                            <span
                                aria-hidden="true"
                                data-slot="change-arrow"
                                className="inline-flex align-[-2px] text-dhis2-grey-600 [&_svg]:size-3.5"
                            >
                                <change.direction.Arrow />
                            </span>
                            <span className="sr-only">
                                {change.direction.word}
                            </span>{' '}
                        </>
                    ) : null}
                    {change.text}
                </p>
            ) : null}
            {plottable ? (
                <Sparkline series={series} unit={unit} maxPoints={maxPoints} />
            ) : null}
        </ObservationCardFrame>
    )
}
