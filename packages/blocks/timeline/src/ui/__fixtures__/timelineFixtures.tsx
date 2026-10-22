import React from 'react'
import type {
    SourceState,
    TimelineEntry,
    TimelineSourcesResult,
} from '../../core/types'
import {
    buildTimelineState,
    TimelineProvider,
    type TimelineActions,
    type TimelineMeta,
    type TimelineState,
} from '../TimelineContext'

export const TODAY = '2026-10-22'

export const entry = (
    id: string,
    at: string,
    extra: Partial<TimelineEntry<string>> = {}
): TimelineEntry<string> => ({
    id,
    at,
    sourceKey: 'a',
    data: id,
    ...extra,
})

export const source = (
    key: string,
    status: SourceState['status'],
    extra: Partial<SourceState> = {}
): SourceState => ({
    key,
    label: key.toUpperCase(),
    status,
    partial: false,
    loadingMore: false,
    ...extra,
})

export const META: TimelineMeta = {
    order: 'desc',
    calendar: 'gregorian',
    locale: 'en',
    today: TODAY,
}

export const stateOf = (
    result: Partial<
        Omit<TimelineSourcesResult<string>, 'loadMore' | 'retry'>
    > = {}
): TimelineState<string> =>
    buildTimelineState<string>(
        {
            entries: [],
            status: 'ready',
            sources: [source('a', 'complete')],
            hasMore: false,
            loadingMore: false,
            loadMore: () => undefined,
            retry: () => undefined,
            ...result,
        },
        {
            order: META.order,
            groupBy: 'day',
            today: TODAY,
            calendar: META.calendar,
            locale: META.locale,
            labels: {
                overdue: 'Overdue',
                undated: 'Undated',
                allEntries: 'All entries',
            },
        }
    )

export const actionsOf = (
    overrides: Partial<TimelineActions> = {}
): TimelineActions => ({
    loadMore: () => undefined,
    retry: () => undefined,
    ...overrides,
})

/** A hand-written provider: no sources are merged. */
export const Provided = ({
    state,
    actions = actionsOf(),
    children,
}: {
    state: TimelineState<string>
    actions?: TimelineActions
    children: React.ReactNode
}) => (
    <TimelineProvider state={state} actions={actions} meta={META}>
        {children}
    </TimelineProvider>
)
