import i18n from '@dhis2/d2-i18n'
import { IconWarningFilled16 } from '@dhis2/ui-icons'
import React from 'react'
import type { ObservationResult } from '../use-tracked-entity-observations'
import { LegendBadge } from './LegendBadge'
import { ObservationCardFrame } from './ObservationCardFrame'
import { useFormatDate } from './calendar'
import {
    NO_ESCAPE,
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

/**
 * One key per English plural form: d2-app-scripts cannot extract `count`
 * plurals, so the form is picked here. `count` still reaches i18next for a
 * translation that defines its own plural forms.
 */
const staleNote = (days: number): string =>
    days === 1
        ? i18n.t('Out of date: last recorded over {{count}} day ago', {
              count: days,
              interpolation: NO_ESCAPE,
          })
        : i18n.t('Out of date: last recorded over {{count}} days ago', {
              count: days,
              interpolation: NO_ESCAPE,
          })

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
    const partialNote = series.partial
        ? i18n.t('Some visits are hidden by your access')
        : undefined

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
                    <span>
                        {i18n.t('Recorded {{date}} · {{stage}}', {
                            date: formatDate(latest.occurredAt),
                            stage: latest.source.programStageName,
                            interpolation: NO_ESCAPE,
                        })}
                    </span>
                    {stale && staleAfterDays !== undefined ? (
                        <span
                            data-slot="stale-note"
                            className="inline-flex items-center gap-1 font-medium text-dhis2-yellow-800"
                        >
                            <span
                                aria-hidden="true"
                                className="inline-flex shrink-0 [&_svg]:size-3.5"
                            >
                                <IconWarningFilled16 />
                            </span>
                            {staleNote(staleAfterDays)}
                        </span>
                    ) : null}
                    {partialNote ? <span>{partialNote}</span> : null}
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
