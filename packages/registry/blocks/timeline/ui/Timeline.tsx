import i18n from '@dhis2/d2-i18n'
import React, { useId, useMemo, type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import type { Dhis2Calendar } from '@/components/dhis2-value-display/calendar'
import { groupTimeline } from '../core/group'
import type {
    GroupBy,
    TimelineEntry,
    TimelineOrder,
    TimelineStatus,
} from '../core/types'
import {
    TimelineContextProvider,
    TimelineMetaProvider,
    useTimelineMeta,
    type TimelineContextValue,
} from './TimelineContext'

export interface TimelineProps<TData> extends Omit<
    ComponentPropsWithoutRef<'div'>,
    'children'
> {
    entries: ReadonlyArray<TimelineEntry<TData>>
    /** Where the data behind `entries` stands; defaults to `'success'`. */
    status?: TimelineStatus
    order?: TimelineOrder
    /**
     * How entries are grouped. A function is part of what the groups depend
     * on, so memoise it with `useCallback`; a new one each render regroups
     * every render.
     */
    groupBy?: GroupBy<TData>
    calendar: Dhis2Calendar
    locale?: string
    /** The current moment; defaults to the real one. */
    now?: Date
    children: React.ReactNode
}

const TimelineLayout = <TData,>({
    entries,
    status,
    groupBy,
    children,
}: {
    entries: ReadonlyArray<TimelineEntry<TData>>
    status: TimelineStatus
    groupBy: GroupBy<TData>
    children: React.ReactNode
}) => {
    const id = useId()
    const meta = useTimelineMeta()
    const value = useMemo((): TimelineContextValue<TData> => {
        const { groups, nowIndex } = groupTimeline([...entries], {
            order: meta.order,
            groupBy,
            today: meta.today,
            calendar: meta.calendar,
            locale: meta.locale,
            labels: {
                overdue: i18n.t('Overdue'),
                undated: i18n.t('Undated'),
                allEntries: i18n.t('All entries'),
            },
        })
        return {
            state: { entries, groups, nowIndex, status },
            meta: { ...meta, id },
        }
    }, [id, entries, status, meta, groupBy])
    return (
        <TimelineContextProvider value={value}>
            {children}
        </TimelineContextProvider>
    )
}

/**
 * Lays `entries` out by day around "now" and shares them, with calendar,
 * locale and today, with the parts inside it. It never fetches: pass whatever
 * array you have, filtered and merged however you like.
 */
export const Timeline = <TData,>({
    entries,
    status = 'success',
    order = 'desc',
    groupBy = 'day',
    calendar,
    locale,
    now,
    className,
    children,
    ...props
}: TimelineProps<TData>) => (
    <TimelineMetaProvider
        calendar={calendar}
        locale={locale}
        order={order}
        now={now}
    >
        <TimelineLayout entries={entries} status={status} groupBy={groupBy}>
            <div
                {...props}
                data-slot="timeline"
                className={cn('flex flex-col gap-3', className)}
            >
                {children}
            </div>
        </TimelineLayout>
    </TimelineMetaProvider>
)
