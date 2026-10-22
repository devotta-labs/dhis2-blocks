import type { Result } from 'better-result'

export type TimelinePhase = 'future' | 'overdue' | 'past'

export interface TimelineEntry<TData = unknown> {
    id: string
    /** The stored date or date-time, exactly as the server wrote it. */
    at: string
    precision?: 'instant' | 'day'
    /** Orders entries that share the same instant. */
    sequence?: number
    /** Defaults from the stored day: after today is future, otherwise past. */
    phase?: TimelinePhase
    sourceKey: string
    data: TData
}

export type TimelineOrder = 'asc' | 'desc'

export type GroupBy<TData> =
    | 'day'
    | 'none'
    | ((entry: TimelineEntry<TData>) => { key: string; label: string })

export interface TimelineGroup<TData = unknown> {
    key: string
    label: string
    phase: TimelinePhase | 'undated'
    entries: TimelineEntry<TData>[]
}

export type SourceError =
    | { kind: 'unsupported'; message: string }
    | { kind: 'failed'; error: Error }

export interface SourcePage<TData> {
    entries: TimelineEntry<TData>[]
    nextCursor?: unknown
    /** "Every entry at or after this stored date or date-time has been returned." A date with no time covers that whole day. */
    completeUntil?: string
    /** The server trimmed this source's result; stays set until the source restarts. */
    partial?: boolean
    /** Shown by TimelineSourceNotices until a later page clears it. */
    notice?: string
}

export interface TimelineSource<TData = unknown> {
    key: string
    label: string
    /** Change it to make the source start again from its first page. */
    revision?: unknown
    fetchPage(
        cursor: unknown | undefined,
        signal: AbortSignal
    ): Promise<Result<SourcePage<TData>, SourceError>>
}

export type SourceStatus =
    | 'loading'
    | 'hasMore'
    | 'complete'
    | 'unsupported'
    | 'error'

export interface SourceState {
    key: string
    label: string
    status: SourceStatus
    partial: boolean
    loadingMore: boolean
    completeUntil?: string
    error?: SourceError
    notice?: string
}

export interface TimelineSourcesResult<TData> {
    entries: TimelineEntry<TData>[]
    status: 'loading' | 'ready'
    sources: SourceState[]
    hasMore: boolean
    loadingMore: boolean
    loadMore(): void
    retry(sourceKey: string): void
}
