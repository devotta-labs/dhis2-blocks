import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type { ObservationResult } from '../use-tracked-entity-observations'
import { LegendBadge } from './LegendBadge'
import { ObservationCardFrame, PartialNote } from './ObservationCardFrame'
import { RecordedNote } from './RecordedNote'
import { useFormatDate } from './calendar'
import {
    displayValue,
    isStale,
    isSupportedLatestType,
    legendFor,
    optionFor,
} from './format'

export interface LatestValueCardProps {
    observation: ObservationResult
    /** Overrides the data element's own label. */
    label?: string
    /** Shown after a numeric value, such as `kg`. */
    unit?: string
    /**
     * Once the latest reading is older than this many days, greys the value
     * and adds an "Out of date" warning note. Off when unset.
     */
    staleAfterDays?: number
    className?: string
}

/** Read per render so tests can stub the clock. */
const now = () => new Date()

const TEXT_TYPES = new Set(['TEXT', 'LONG_TEXT'])

/** The last recorded value of a data element: a number, option, yes/no, date or text. */
export function LatestValueCard({
    observation,
    label,
    unit,
    staleAfterDays,
    className,
}: LatestValueCardProps) {
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
    const partialNote = series.partial ? <PartialNote /> : undefined

    if (
        !isSupportedLatestType(series.valueType, series.options !== undefined)
    ) {
        return (
            <ObservationCardFrame
                label={title}
                footer={partialNote}
                className={className}
            >
                <p className="text-sm text-dhis2-grey-700">
                    {i18n.t("This value type can't be shown here")}
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

    const stale = isStale(latest, staleAfterDays, now())
    const isOption = series.options !== undefined
    const legend =
        isOption || latest.numericValue === undefined
            ? undefined
            : legendFor(series.legends, latest.numericValue)
    const showUnit = !isOption && latest.numericValue !== undefined && unit
    const isText = !isOption && TEXT_TYPES.has(series.valueType)

    return (
        <ObservationCardFrame
            label={title}
            badge={<LegendBadge legend={legend} option={undefined} />}
            tone={stale ? 'stale' : 'default'}
            footer={
                <>
                    <RecordedNote
                        point={latest}
                        staleAfterDays={staleAfterDays}
                    />
                    {partialNote}
                </>
            }
            className={className}
        >
            {isOption ? (
                <LegendBadge
                    legend={undefined}
                    option={optionFor(series.options, latest.value)}
                />
            ) : (
                <p className="flex items-baseline gap-1">
                    <span
                        data-slot="observation-value"
                        className={
                            isText
                                ? 'line-clamp-3 text-base break-words'
                                : 'text-3xl leading-none font-semibold break-words'
                        }
                    >
                        {displayValue(series, latest, formatDate)}
                    </span>
                    {showUnit ? (
                        <span className="text-sm text-dhis2-grey-700">
                            {unit}
                        </span>
                    ) : null}
                </p>
            )}
        </ObservationCardFrame>
    )
}
