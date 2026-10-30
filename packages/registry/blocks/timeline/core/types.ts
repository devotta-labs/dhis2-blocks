export type TimelinePhase = 'future' | 'overdue' | 'past'

export interface TimelineEntry<TData = unknown> {
    /** Unique within the timeline; namespace it by kind when mixing data. */
    id: string
    /** The stored date or date-time, exactly as the server wrote it. */
    at: string
    precision?: 'instant' | 'day'
    /** Orders entries that share the same instant. */
    sequence?: number
    /**
     * Defaults from the stored day: after the viewer's day is future, otherwise
     * past. Set `'past'` on what has already happened: a server clock ahead of
     * the viewer's stores it under tomorrow.
     */
    phase?: TimelinePhase
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

/** Where the data behind the entries stands; the timeline never fetches. */
export type TimelineStatus = 'pending' | 'error' | 'success'

/** Something the viewer should know about the history: a failure, a cap, a missing feature. */
export interface TimelineNotice {
    id: string
    tone: 'info' | 'warning' | 'error'
    message: string
    /** Shown as a Retry button. */
    retry?: () => void
}
