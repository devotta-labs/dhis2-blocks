import { comparableKey, compareEntries, cutoffKey } from './sort'
import type {
    SourceError,
    SourcePage,
    SourceStatus,
    TimelineEntry,
} from './types'

export interface MergeSource {
    key: string
    status: SourceStatus
    /** Whether the source has ever answered, with a page or an error. Until then it limits the feed. */
    settled: boolean
    /** Whether a page has been applied since the source last (re)started. */
    hasPage: boolean
    /** The source's entries are from before a restart and go when its new first page arrives. */
    stale: boolean
    loadingMore: boolean
    partial: boolean
    cursor?: unknown
    completeUntil?: string
    error?: SourceError
    notice?: string
}

interface MergedEntry<TData> {
    entry: TimelineEntry<TData>
    /** The source whose page supplied this copy. */
    owner: string
}

export interface MergeState<TData> {
    keys: readonly string[]
    sources: ReadonlyMap<string, MergeSource>
    entries: ReadonlyMap<string, MergedEntry<TData>>
}

/** Above every comparable key, which all start with a digit. */
const END_OF_TIME = String.fromCharCode(0xffff)

const freshSource = (key: string): MergeSource => ({
    key,
    status: 'loading',
    settled: false,
    hasPage: false,
    stale: false,
    loadingMore: false,
    partial: false,
})

export const initialMergeState = <TData>(
    keys: readonly string[]
): MergeState<TData> => ({
    keys: [...keys],
    sources: new Map(keys.map((key) => [key, freshSource(key)])),
    entries: new Map(),
})

const updateSource = <TData>(
    state: MergeState<TData>,
    key: string,
    update: (source: MergeSource) => MergeSource
): MergeState<TData> => {
    const source = state.sources.get(key)
    if (source === undefined) {
        return state
    }
    const sources = new Map(state.sources)
    sources.set(key, update(source))
    return { ...state, sources }
}

const dropEntriesOf = <TData>(
    entries: ReadonlyMap<string, MergedEntry<TData>>,
    keep: (owner: string) => boolean
) => new Map([...entries].filter(([, merged]) => keep(merged.owner)))

/**
 * Keeps the listed sources in that order, adds new ones as loading their
 * first page, and drops the rest along with their entries.
 */
export const retainSources = <TData>(
    state: MergeState<TData>,
    keys: readonly string[]
): MergeState<TData> => {
    const wanted = new Set(keys)
    return {
        keys: [...keys],
        sources: new Map(
            keys.map((key) => [key, state.sources.get(key) ?? freshSource(key)])
        ),
        entries: dropEntriesOf(state.entries, (owner) => wanted.has(owner)),
    }
}

/**
 * Marks a request as started. `restart` fetches the first page again, keeping
 * the source's entries on show until it answers; `more` fetches the page after
 * the cursor; `retry` repeats the request that failed (the first page, if none
 * arrived since the source started). Only a source that has never answered
 * limits the feed while it loads.
 */
export const startLoading = <TData>(
    state: MergeState<TData>,
    key: string,
    mode: 'restart' | 'more' | 'retry'
): MergeState<TData> => {
    const source = state.sources.get(key)
    if (source === undefined) {
        return state
    }
    if (mode === 'restart') {
        return updateSource(state, key, (s) =>
            s.settled
                ? {
                      ...s,
                      status: 'loading',
                      hasPage: false,
                      stale: true,
                      loadingMore: false,
                      error: undefined,
                  }
                : freshSource(key)
        )
    }
    if (mode === 'more') {
        return updateSource(state, key, (s) => ({ ...s, loadingMore: true }))
    }
    return updateSource(state, key, (s) => ({
        ...s,
        status: 'loading',
        error: undefined,
    }))
}

/** Of two true "complete until" claims, the older one is the stronger. */
const strongerCutoff = (previous?: string, next?: string) => {
    if (previous === undefined || next === undefined) {
        return next ?? previous
    }
    const previousKey = cutoffKey(previous) ?? END_OF_TIME
    const nextKey = cutoffKey(next) ?? END_OF_TIME
    return nextKey < previousKey ? next : previous
}

export const applyPage = <TData>(
    state: MergeState<TData>,
    key: string,
    page: SourcePage<TData>
): MergeState<TData> => {
    const source = state.sources.get(key)
    if (source === undefined) {
        return state
    }
    const entries = source.stale
        ? dropEntriesOf(state.entries, (owner) => owner !== key)
        : new Map(state.entries)
    for (const entry of page.entries) {
        entries.set(entry.id, { entry, owner: key })
    }
    // A first page starts the source's claims afresh.
    const previous = source.hasPage ? source : undefined
    const next = updateSource(state, key, () => ({
        ...source,
        status: page.nextCursor === undefined ? 'complete' : 'hasMore',
        settled: true,
        hasPage: true,
        stale: false,
        loadingMore: false,
        partial: (previous?.partial ?? false) || page.partial === true,
        cursor: page.nextCursor,
        completeUntil: strongerCutoff(
            previous?.completeUntil,
            page.completeUntil
        ),
        error: undefined,
        notice: page.notice,
    }))
    return { ...next, entries }
}

export const applyError = <TData>(
    state: MergeState<TData>,
    key: string,
    error: SourceError
): MergeState<TData> =>
    updateSource(state, key, (source) => ({
        ...source,
        status: error.kind === 'unsupported' ? 'unsupported' : 'error',
        settled: true,
        loadingMore: false,
        error,
    }))

/** A source that has never answered, so nothing it holds is known yet. */
export const isAwaitingFirstAnswer = (source: MergeSource) =>
    source.status === 'loading' && !source.settled

/** How far back a source lets the feed reach, or undefined if it doesn't limit it. */
const sourceCutoff = (source: MergeSource): string | undefined => {
    if (isAwaitingFirstAnswer(source)) {
        return END_OF_TIME
    }
    if (source.status !== 'hasMore') {
        return undefined
    }
    // No claim yet (or an unreadable one) means nothing is known complete.
    return source.completeUntil === undefined
        ? END_OF_TIME
        : (cutoffKey(source.completeUntil) ?? END_OF_TIME)
}

const feedCutoff = <TData>(state: MergeState<TData>): string | undefined => {
    let cutoff: string | undefined
    for (const source of state.sources.values()) {
        const key = sourceCutoff(source)
        if (key !== undefined && (cutoff === undefined || key > cutoff)) {
            cutoff = key
        }
    }
    return cutoff
}

/**
 * The entries the feed may show: future entries, then overdue, then past, each
 * newest first. Future and overdue entries always show; past entries at or
 * after every limiting source's `completeUntil`; undated entries only once no
 * source limits the feed. Released entries only ever join the end.
 */
export const visibleEntries = <TData>(
    state: MergeState<TData>
): TimelineEntry<TData>[] => {
    const cutoff = feedCutoff(state)
    const future: TimelineEntry<TData>[] = []
    const overdue: TimelineEntry<TData>[] = []
    const past: TimelineEntry<TData>[] = []
    for (const { entry } of state.entries.values()) {
        if (entry.phase === 'future') {
            future.push(entry)
        } else if (entry.phase === 'overdue') {
            overdue.push(entry)
        } else {
            const key = comparableKey(entry)
            if (cutoff === undefined || (key !== undefined && key >= cutoff)) {
                past.push(entry)
            }
        }
    }
    const newestFirst = compareEntries('desc')
    return [
        ...future.sort(newestFirst),
        ...overdue.sort(newestFirst),
        ...past.sort(newestFirst),
    ]
}

/** The sources with more pages whose cut-off is the one limiting the feed. */
export const limitingSources = <TData>(state: MergeState<TData>): string[] => {
    const cutoff = feedCutoff(state)
    return state.keys.filter((key) => {
        const source = state.sources.get(key)
        return (
            source?.status === 'hasMore' &&
            cutoff !== undefined &&
            sourceCutoff(source) === cutoff
        )
    })
}
