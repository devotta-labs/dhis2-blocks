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
