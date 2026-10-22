import React, {
    createContext,
    useContext,
    useId,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from 'react'
import type { Dhis2Calendar } from '@/registry/dhis2/value-display/calendar'
import { buildTimelineGroups, type GroupOptions } from '../core/group'
import type {
    SourceState,
    TimelineEntry,
    TimelineGroup,
    TimelineOrder,
    TimelineSourcesResult,
} from '../core/types'

export interface TimelineState<TData = unknown> {
    entries: TimelineEntry<TData>[]
    groups: TimelineGroup<TData>[]
    /** The now marker sits before `groups[nowIndex]`. */
    nowIndex: number
    status: 'loading' | 'ready'
    sources: SourceState[]
    hasMore: boolean
    loadingMore: boolean
    /** Every source is complete or unsupported, and there is nothing to show. */
    isEmpty: boolean
    /** Every source failed. */
    allFailed: boolean
}

export interface TimelineActions {
    loadMore(): void
    retry(sourceKey: string): void
}

export interface TimelineMeta {
    order: TimelineOrder
    calendar: Dhis2Calendar
    locale?: string
    /** The current day as `YYYY-MM-DD`. */
    today: string
}

export const buildTimelineState = <TData,>(
    result: TimelineSourcesResult<TData>,
    options: GroupOptions<TData>
): TimelineState<TData> => {
    const { groups, nowIndex } = buildTimelineGroups(result.entries, options)
    const { sources } = result
    return {
        entries: result.entries,
        groups,
        nowIndex,
        status: result.status,
        sources,
        hasMore: result.hasMore,
        loadingMore: result.loadingMore,
        isEmpty:
            result.entries.length === 0 &&
            sources.every(
                (source) =>
                    source.status === 'complete' ||
                    source.status === 'unsupported'
            ),
        allFailed:
            sources.length > 0 &&
            sources.every((source) => source.status === 'error'),
    }
}

interface Snapshot {
    state: TimelineState<unknown>
    meta: TimelineMeta
}

interface TimelineStore {
    get(): Snapshot
    /** Makes `next` what consumers read from now on, without notifying. */
    replace(next: Snapshot): void
    /** Tells subscribers about whatever `replace` last stored. */
    publish(): void
    subscribe(listener: () => void): () => void
}

const createStore = (initial: Snapshot): TimelineStore => {
    let snapshot = initial
    let published = initial
    const listeners = new Set<() => void>()
    return {
        get: () => snapshot,
        replace: (next) => {
            if (next.state !== snapshot.state || next.meta !== snapshot.meta) {
                snapshot = next
            }
        },
        publish: () => {
            if (
                snapshot.state === published.state &&
                snapshot.meta === published.meta
            ) {
                return
            }
            published = snapshot
            listeners.forEach((listener) => listener())
        },
        subscribe: (listener) => {
            listeners.add(listener)
            return () => {
                listeners.delete(listener)
            }
        },
    }
}

interface TimelineContextValue {
    store: TimelineStore
    actions: TimelineActions
    /** Tells this timeline's elements apart from another one on the page. */
    id: string
}

const TimelineContext = createContext<TimelineContextValue | null>(null)

const useTimelineContext = (): TimelineContextValue => {
    const context = useContext(TimelineContext)
    if (context === null) {
        throw new Error(
            'Timeline hooks must be used within Timeline or TimelineProvider.'
        )
    }
    return context
}

export interface TimelineProviderProps<TData> {
    state: TimelineState<TData>
    actions: TimelineActions
    meta: TimelineMeta
    children: React.ReactNode
}

/**
 * Shares the state, actions and meta. The snapshot is taken during render and
 * subscribers are notified after commit; a discarded concurrent render can
 * leave the snapshot briefly ahead of what committed (known limitation).
 */
export const TimelineProvider = <TData,>({
    state,
    actions,
    meta,
    children,
}: TimelineProviderProps<TData>) => {
    const id = useId()
    const snapshot: Snapshot = { state, meta }
    const [store] = useState(() => createStore(snapshot))
    // Consumers rendered in this pass must see this pass's state, so the store
    // takes it during render; subscribers that were not re-rendered by this
    // pass are told once it has committed.
    store.replace(snapshot)
    useLayoutEffect(() => {
        store.publish()
    })
    // Actions are read through a ref so a new `actions` object never
    // re-renders consumers.
    const actionsRef = useRef(actions)
    actionsRef.current = actions
    const value = useMemo<TimelineContextValue>(
        () => ({
            store,
            id,
            actions: {
                loadMore: () => actionsRef.current.loadMore(),
                retry: (sourceKey) => actionsRef.current.retry(sourceKey),
            },
        }),
        [store, id]
    )
    return (
        <TimelineContext.Provider value={value}>
            {children}
        </TimelineContext.Provider>
    )
}

/**
 * Reads a slice of the timeline state. The component re-renders only when the
 * selected value changes, so select a primitive or an existing reference.
 */
export const useTimelineState = <TData, TSelected>(
    selector: (state: TimelineState<TData>) => TSelected
): TSelected => {
    const { store } = useTimelineContext()
    // SAFETY: the provider stored a TimelineState<TData'> for the host's own
    // TData'; the host picks the same TData here, as with any typed context.
    const read = () => selector(store.get().state as TimelineState<TData>)
    return useSyncExternalStore(store.subscribe, read, read)
}

export const useTimelineMeta = <TSelected,>(
    selector: (meta: TimelineMeta) => TSelected
): TSelected => {
    const { store } = useTimelineContext()
    const read = () => selector(store.get().meta)
    return useSyncExternalStore(store.subscribe, read, read)
}

export const useTimelineActions = (): TimelineActions =>
    useTimelineContext().actions

/** This timeline's id, for DOM ids and attributes that must not clash. */
export const useTimelineId = (): string => useTimelineContext().id

export const groupHeadingId = (id: string, group: TimelineGroup<unknown>) =>
    `${id}-${group.phase}:${group.key}`
