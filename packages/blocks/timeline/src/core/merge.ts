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
    /** Whether a page has been applied since the source last (re)started. */
    hasPage: boolean
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
const END_OF_TIME = '￿'

const freshSource = (key: string): MergeSource => ({
    key,
    status: 'loading',
    hasPage: false,
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
 * Marks a request as started. `restart` forgets the source's pages and fetches
 * its first page; `more` fetches the page after its cursor; `retry` repeats the
 * request that failed (the first page, if none arrived).
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
    if (mode === 'restart' || (mode === 'retry' && !source.hasPage)) {
        return {
            ...updateSource(state, key, () => freshSource(key)),
            entries: dropEntriesOf(state.entries, (owner) => owner !== key),
        }
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
    if (!state.sources.has(key)) {
        return state
    }
    const entries = new Map(state.entries)
    for (const entry of page.entries) {
        entries.set(entry.id, { entry, owner: key })
    }
    const next = updateSource(state, key, (source) => ({
        ...source,
        status: page.nextCursor === undefined ? 'complete' : 'hasMore',
        hasPage: true,
        loadingMore: false,
        partial: source.partial || page.partial === true,
        cursor: page.nextCursor,
        completeUntil: strongerCutoff(source.completeUntil, page.completeUntil),
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
        loadingMore: false,
        error,
    }))

/** How far back a source lets the feed reach, or undefined if it doesn't limit it. */
const sourceCutoff = (source: MergeSource): string | undefined => {
    if (source.status === 'loading' && !source.hasPage) {
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
 * The entries the feed may show, newest first: future and overdue entries
 * always; past entries at or after every limiting source's `completeUntil`;
 * undated entries only once no source limits the feed.
 */
export const visibleEntries = <TData>(
    state: MergeState<TData>
): TimelineEntry<TData>[] => {
    const cutoff = feedCutoff(state)
    const visible: TimelineEntry<TData>[] = []
    for (const { entry } of state.entries.values()) {
        if (entry.phase === 'future' || entry.phase === 'overdue') {
            visible.push(entry)
            continue
        }
        const key = comparableKey(entry)
        const shown =
            cutoff === undefined || (key !== undefined && key >= cutoff)
        if (shown) {
            visible.push(entry)
        }
    }
    return visible.sort(compareEntries('desc'))
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
