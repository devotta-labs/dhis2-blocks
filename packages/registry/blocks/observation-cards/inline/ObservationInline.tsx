import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { CardNote } from '../card/frame'
import { formatPointValue, isStale, legendFor } from '../format/display'
import { useDisplayOptions } from '../format/useDisplayOptions'
import { useObservation } from '../hooks'
import { MetadataBadge } from '../parts/ObservationLegend'
import { RecordedNote } from '../parts/ObservationRecorded'
import { useObservationsContext } from '../provider/context'
import { isProduction } from '../provider/env'

export interface ObservationInlineProps {
    /** The data element whose latest reading is shown. */
    dataElement: string
    /** Shown after a number, such as `kg`. */
    unit?: string
    /** Overrides the data element's own name. */
    label?: string
    /** Once the latest reading is older than this many days, adds "Out of date". Off when unset. */
    staleAfterDays?: number
    className?: string
}

const ROW =
    'inline-flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1 text-sm'

/**
 * One data element's latest reading as a single line for a facts line: label,
 * value with unit, legend name, and how long ago it was recorded. No frame,
 * chart or change. It needs an `ObservationsProvider` above it.
 */
export function ObservationInline({
    dataElement,
    unit,
    label,
    staleAfterDays,
    className,
}: ObservationInlineProps) {
    const state = useObservation(dataElement)
    const display = useDisplayOptions()
    const { metadata } = useObservationsContext()
    const element = metadata?.dataElements.get(dataElement)
    // An empty label is no label.
    const earlyName =
        label ||
        element?.displayFormName ||
        element?.displayName ||
        metadata?.invalidDataElements.get(dataElement)?.displayName

    if (state.status === 'pending') {
        return (
            <div
                data-slot="observation-inline"
                aria-busy="true"
                className={cn(ROW, className)}
            >
                <Skeleton className="h-4 w-24" />
                <span className="sr-only">{i18n.t('Loading')}</span>
            </div>
        )
    }
    if (state.status === 'misconfigured') {
        return (
            <div
                data-slot="observation-inline"
                role="alert"
                className={cn(ROW, className)}
            >
                <span
                    data-slot="observation-config-error"
                    className="text-sm break-words text-dhis2-destructive-strong"
                >
                    {isProduction()
                        ? i18n.t("This card isn't set up correctly")
                        : state.message}
                </span>
            </div>
        )
    }

    const series = state.status === 'ready' ? state.series : undefined
    const latest = series?.latest
    const name = label || series?.label || earlyName
    const now = new Date()
    const legend =
        series && !series.options
            ? legendFor(series.legends, latest?.numericValue)
            : undefined

    let body
    if (series && latest) {
        const shownUnit = latest.numericValue === undefined ? undefined : unit
        const text = formatPointValue(series, latest, display)
        body = (
            <>
                <span data-slot="value-text" className="text-dhis2-foreground">
                    {shownUnit ? `${text} ${shownUnit}` : text}
                </span>
                {legend ? (
                    <MetadataBadge name={legend.name} color={legend.color} />
                ) : null}
                <span className="text-xs text-dhis2-muted-foreground">
                    <RecordedNote
                        point={latest}
                        staleAfterDays={staleAfterDays}
                        stale={isStale(latest, staleAfterDays, now)}
                        now={now}
                        display={display}
                    />
                </span>
            </>
        )
    } else if (series && !series.partial) {
        body = (
            <span className="text-dhis2-muted-foreground">
                {i18n.t('Not recorded')}
            </span>
        )
    } else {
        body = (
            <span data-slot="observation-error">
                <CardNote tone="error">{i18n.t('Unavailable')}</CardNote>
            </span>
        )
    }

    return (
        <div data-slot="observation-inline" className={cn(ROW, className)}>
            {/* Without a name, just the value: a dd needs a dt. */}
            {name ? (
                <dl className={cn(ROW, 'm-0')}>
                    <dt className="text-dhis2-muted-foreground">{name}</dt>
                    <dd className={cn(ROW, 'm-0')}>{body}</dd>
                </dl>
            ) : (
                body
            )}
        </div>
    )
}
