import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type {
    ObservationResult,
    ObservationSeries,
} from '../use-tracked-entity-observations'
import { LegendBadge } from './LegendBadge'
import { ObservationCardFrame } from './ObservationCardFrame'
import { Sparkline } from './Sparkline'
import { useFormatDate } from './calendar'
import { displayValue, formatNumber, isTrendType, legendFor } from './format'

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

// React escapes text itself, so i18next must not escape it a second time.
const NO_ESCAPE = { escapeValue: false }

/** The change since the previous reading, or nothing when there is no earlier one. */
const changeText = (
    series: ObservationSeries,
    formatDate: (iso: string) => string
): string | undefined => {
    const { change, previous } = series
    if (change === undefined || previous === undefined) {
        return undefined
    }
    const date = formatDate(previous.occurredAt)
    // A change that rounds to nothing would otherwise read "▲ 0".
    if (Math.round(change * 100) === 0) {
        return i18n.t('No change since {{date}}', {
            date,
            interpolation: NO_ESCAPE,
        })
    }
    const amount = formatNumber(Math.abs(change))
    return change > 0
        ? i18n.t('▲ {{change}} since {{date}}', {
              change: amount,
              date,
              interpolation: NO_ESCAPE,
          })
        : i18n.t('▼ {{change}} since {{date}}', {
              change: amount,
              date,
              interpolation: NO_ESCAPE,
          })
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
    const partialNote = series.partial
        ? i18n.t('Some visits are hidden by your access')
        : undefined

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
    const change = changeText(series, formatDate)

    return (
        <ObservationCardFrame
            label={title}
            badge={<LegendBadge legend={legend} option={undefined} />}
            footer={
                <>
                    <span>
                        {i18n.t('Recorded {{date}} · {{stage}}', {
                            date: formatDate(latest.occurredAt),
                            stage: latest.source.programStageName,
                            interpolation: NO_ESCAPE,
                        })}
                    </span>
                    {partialNote ? <span>{partialNote}</span> : null}
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
                <p className="text-sm text-dhis2-grey-700">{change}</p>
            ) : null}
            <Sparkline series={series} maxPoints={maxPoints} />
        </ObservationCardFrame>
    )
}
