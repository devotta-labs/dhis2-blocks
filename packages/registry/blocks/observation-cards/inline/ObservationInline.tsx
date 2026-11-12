import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { useMemo, type ReactNode } from 'react'
import { buildSeries } from '../api/buildSeries'
import { usePersonEvents, useProgramMetadata } from '../api/queries'
import type {
    DataElementMetadata,
    StageMetadata,
    TrackerEventRecord,
} from '../api/types'
import { CardNote } from '../card/frame'
import {
    formatPointValue,
    isStale,
    isSupportedValueType,
    legendFor,
} from '../format/display'
import { useDisplayOptions } from '../format/useDisplayOptions'
import { MetadataBadge } from '../parts/ObservationLegend'
import { PartialNote, RecordedNote } from '../parts/ObservationRecorded'
import { useObservationsSubject } from '../provider/context'
import { isProduction } from '../provider/env'
import {
    describeMisconfigured,
    useSetupErrorLog,
} from '../provider/misconfigured'

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

/** The line: the name, when there is one, and what is known of the value. */
function Row({
    name,
    className,
    children,
}: {
    name?: string
    className?: string
    children: ReactNode
}) {
    return (
        <div data-slot="observation-inline" className={cn(ROW, className)}>
            {/* Without a name, just the value: a dd needs a dt. */}
            {name ? (
                <dl className={cn(ROW, 'm-0')}>
                    <dt className="text-dhis2-muted-foreground">{name}</dt>
                    <dd className={cn(ROW, 'm-0')}>{children}</dd>
                </dl>
            ) : (
                children
            )}
        </div>
    )
}

function LoadingRow({ className }: { className?: string }) {
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

const Unavailable = () => (
    <span data-slot="observation-error">
        <CardNote tone="error">{i18n.t('Unavailable')}</CardNote>
    </span>
)

/**
 * A data element no stage of the program captures. Development shows the
 * full setup message; production shows a short one and logs the full message.
 */
function MisconfiguredRow({
    message,
    className,
}: {
    message: string
    className?: string
}) {
    useSetupErrorLog(message)
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
                    ? i18n.t("This part isn't set up correctly")
                    : message}
            </span>
        </div>
    )
}

/** The latest reading of a loaded data element, or why there is none to show. */
function Reading({
    element,
    stages,
    events,
    unit,
    staleAfterDays,
}: {
    element: DataElementMetadata
    stages: StageMetadata[]
    events: TrackerEventRecord[]
    unit?: string
    staleAfterDays?: number
}) {
    const display = useDisplayOptions()
    const series = useMemo(
        () => buildSeries({ dataElement: element, stages, events }),
        [element, stages, events]
    )
    const { latest } = series

    if (!isSupportedValueType(series)) {
        // As the card: a type it can't format is never shown as a stored string.
        return (
            <>
                <span className="text-dhis2-muted-foreground">
                    {i18n.t("This value type can't be shown here")}
                </span>
                {series.partial ? <PartialNote className="ms-0" /> : null}
            </>
        )
    }
    if (latest === undefined) {
        // With visits the user can't read, "not recorded" would be a guess.
        return series.partial ? (
            <Unavailable />
        ) : (
            <span className="text-dhis2-muted-foreground">
                {i18n.t('Not recorded')}
            </span>
        )
    }

    // Read per render so tests can stub the clock.
    const now = new Date()
    const legend = series.options
        ? undefined
        : legendFor(series.legends, latest.numericValue)
    const shownUnit = latest.numericValue === undefined ? undefined : unit
    const text = formatPointValue(series, latest, display)
    return (
        <>
            <span
                data-slot="value-text"
                className="font-medium text-dhis2-foreground"
            >
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
            {/* Newer visits may be ones this user can't read. */}
            {series.partial ? <PartialNote className="ms-0" /> : null}
        </>
    )
}

/**
 * One data element's latest reading as a single line for a facts line: label,
 * value with unit, legend name, and how long ago it was recorded. No frame,
 * chart or change. It needs an `ObservationsProvider` above it, and shares
 * that provider's requests with the cards beside it.
 */
export function ObservationInline({
    dataElement,
    unit,
    label,
    staleAfterDays,
    className,
}: ObservationInlineProps) {
    const subject = useObservationsSubject()
    const metadata = useProgramMetadata(subject.program)
    const events = usePersonEvents(subject)
    // An empty label is no label.
    const hostLabel = label || undefined

    if (metadata.isError) {
        return (
            <Row name={hostLabel} className={className}>
                <Unavailable />
            </Row>
        )
    }
    if (metadata.isPending) {
        return <LoadingRow className={className} />
    }

    const element = metadata.data.dataElements.get(dataElement)
    if (!element) {
        // Captured, but its metadata can't be read: only this line fails.
        const invalid = metadata.data.invalidDataElements.get(dataElement)
        return invalid ? (
            <Row name={hostLabel ?? invalid.displayName} className={className}>
                <Unavailable />
            </Row>
        ) : (
            <MisconfiguredRow
                message={describeMisconfigured(
                    dataElement,
                    subject.program,
                    metadata.data
                )}
                className={className}
            />
        )
    }

    const name = hostLabel ?? (element.displayFormName || element.displayName)
    if (events.isError) {
        return (
            <Row name={name} className={className}>
                <Unavailable />
            </Row>
        )
    }
    if (events.isPending) {
        return <LoadingRow className={className} />
    }

    return (
        <Row name={name} className={className}>
            <Reading
                element={element}
                stages={metadata.data.stages}
                events={events.data}
                unit={unit}
                staleAfterDays={staleAfterDays}
            />
        </Row>
    )
}
