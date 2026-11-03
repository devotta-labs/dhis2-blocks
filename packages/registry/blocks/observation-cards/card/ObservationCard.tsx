import { Card } from '@/components/dhis2/ui/card'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import React, { useCallback, useMemo, useState, type ReactNode } from 'react'
import { buildSeries } from '../api/buildSeries'
import type { ObservationSeries } from '../api/types'
import {
    displayLocale,
    isStale,
    isSupportedValueType,
    showsTrend,
    type DisplayOptions,
} from '../format/display'
import { useObservation } from '../hooks'
import { ObservationChange } from '../parts/ObservationChange'
import { ObservationLabel } from '../parts/ObservationLabel'
import { ObservationLegend } from '../parts/ObservationLegend'
import {
    ObservationRecorded,
    RecordedFooter,
} from '../parts/ObservationRecorded'
import { ObservationSparkline } from '../parts/ObservationSparkline'
import { ObservationValue } from '../parts/ObservationValue'
import { useObservationsContext } from '../provider/context'
import { isProduction } from '../provider/env'
import { ObservationCardContext } from './context'
import { CardHeading, CardNote, FOOTER_BAND } from './frame'

export interface ObservationCardProps {
    /** The data element whose readings the card shows. */
    dataElement: string
    /** Shown after a number, such as `kg`. */
    unit?: string
    /** Overrides the data element's own name. */
    label?: string
    /**
     * Once the latest reading is older than this many days, greys the card,
     * turns its footer yellow and adds "Out of date" beside the recorded date.
     * Off when unset.
     */
    staleAfterDays?: number
    className?: string
    /** The parts to show; without children the card picks them by value type. */
    children?: ReactNode
}

/** The system calendar and the user's locale, for every date and number shown. */
const useDisplayOptions = (): DisplayOptions => {
    const { systemInfo } = useConfig()
    // `calendar` is in every server's systemInfo, though app-runtime's type leaves it out.
    const calendar = parseDhis2Calendar(
        systemInfo && 'calendar' in systemInfo ? systemInfo.calendar : undefined
    )
    const locale = displayLocale()
    return useMemo(() => ({ calendar, locale }), [calendar, locale])
}

function Frame({
    name,
    stale = false,
    busy = false,
    className,
    children,
}: {
    name?: string
    stale?: boolean
    busy?: boolean
    className?: string
    children: ReactNode
}) {
    return (
        <Card
            data-slot="observation-card"
            role="group"
            aria-label={name || undefined}
            aria-busy={busy || undefined}
            data-tone={stale ? 'stale' : 'default'}
            className={cn(
                'min-w-0 gap-2 border border-dhis2-grey-400 p-4 shadow-none',
                stale && 'text-dhis2-grey-600',
                className
            )}
        >
            {children}
        </Card>
    )
}

/**
 * Whether the loaded card will show a trend, so its skeleton takes the same
 * shape. Until the program's metadata says, a trend, the taller of the two.
 */
const usePendingTrend = (dataElement: string): boolean => {
    const { metadata } = useObservationsContext()
    const element = metadata?.dataElements.get(dataElement)
    return (
        element === undefined ||
        showsTrend(
            buildSeries({ dataElement: element, stages: [], events: [] })
        )
    )
}

/** The loading card, in the shape of the arrangement it will become. */
function LoadingContent({
    heading,
    trend,
}: {
    heading: ReactNode
    trend: boolean
}) {
    return (
        <>
            {heading ?? <Skeleton className="my-0.5 h-4 w-24" />}
            <span className="sr-only">{i18n.t('Loading')}</span>
            <Skeleton className="h-[30px] w-24" />
            {trend ? (
                <>
                    <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
                    {/* Dropped below 13rem, as the sparkline is. */}
                    <div className="@container mt-auto w-full">
                        <Skeleton className="hidden h-10 w-full @[13rem]:block" />
                    </div>
                </>
            ) : null}
            <div className={cn(FOOTER_BAND, trend && 'mt-0')}>
                <Skeleton className="my-0.5 h-3 w-20 max-w-full" />
            </div>
        </>
    )
}

const Notice = ({ children }: { children: ReactNode }) => (
    <p className="text-sm text-dhis2-grey-700">{children}</p>
)

/** No children: numeric readings get the trend, everything else the last recorded value. */
function DefaultArrangement({ series }: { series: ObservationSeries }) {
    const trend = showsTrend(series)
    return (
        <>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                <ObservationLabel />
                <ObservationLegend />
            </div>
            <ObservationValue />
            {trend ? <ObservationChange /> : null}
            {trend ? <ObservationSparkline /> : null}
            <ObservationRecorded />
        </>
    )
}

function ReadyContent({
    series,
    recordedPlaced,
    children,
}: {
    series: ObservationSeries
    recordedPlaced: boolean
    children?: ReactNode
}) {
    if (!isSupportedValueType(series)) {
        return (
            <>
                <ObservationLabel />
                <Notice>{i18n.t("This value type can't be shown here")}</Notice>
                <RecordedFooter />
            </>
        )
    }
    if (series.latest === undefined) {
        return (
            <>
                <ObservationLabel />
                <Notice>{i18n.t('Never recorded')}</Notice>
                <RecordedFooter />
            </>
        )
    }
    return (
        <>
            {children ?? <DefaultArrangement series={series} />}
            {/* The date can be placed, never dropped: an old value must not pass as current. */}
            {recordedPlaced ? null : <RecordedFooter />}
        </>
    )
}

/**
 * One data element's readings for the provider's person. It shows the
 * loading, error, setup, never recorded and unsupported states itself; its
 * parts render only once there is a value to show.
 */
export function ObservationCard({
    dataElement,
    unit,
    label,
    staleAfterDays,
    className,
    children,
}: ObservationCardProps) {
    const state = useObservation(dataElement)
    const pendingTrend = usePendingTrend(dataElement)
    const display = useDisplayOptions()
    const [recordedNotes, setRecordedNotes] = useState(0)
    const registerRecorded = useCallback(() => {
        setRecordedNotes((count) => count + 1)
        return () => setRecordedNotes((count) => count - 1)
    }, [])
    const heading = label ? <CardHeading>{label}</CardHeading> : null

    switch (state.status) {
        case 'pending':
            return (
                <Frame name={label} busy className={className}>
                    <LoadingContent heading={heading} trend={pendingTrend} />
                </Frame>
            )
        case 'error':
            return (
                <Frame name={label} className={className}>
                    {heading}
                    <p data-slot="observation-error" className="text-sm">
                        <CardNote tone="error">
                            {i18n.t("Couldn't load this value")}
                        </CardNote>
                    </p>
                </Frame>
            )
        case 'misconfigured':
            return (
                <Frame name={label} className={className}>
                    {heading}
                    {/* The provider logs the full message in production. */}
                    <p
                        role="alert"
                        data-slot="observation-config-error"
                        className="m-0 rounded-dhis2-sm border border-dhis2-red-500 bg-dhis2-red-050 px-3 py-2 text-sm break-words text-dhis2-red-900"
                    >
                        {isProduction()
                            ? i18n.t("This card isn't set up correctly")
                            : state.message}
                    </p>
                </Frame>
            )
        default: {
            const { series } = state
            const title = label ?? series.label
            const stale =
                series.latest !== undefined &&
                isStale(series.latest, staleAfterDays, new Date())
            return (
                <Frame name={title} stale={stale} className={className}>
                    <ObservationCardContext.Provider
                        value={{
                            series,
                            title,
                            unit,
                            staleAfterDays,
                            display,
                            registerRecorded,
                        }}
                    >
                        <ReadyContent
                            series={series}
                            recordedPlaced={recordedNotes > 0}
                        >
                            {children}
                        </ReadyContent>
                    </ObservationCardContext.Provider>
                </Frame>
            )
        }
    }
}
