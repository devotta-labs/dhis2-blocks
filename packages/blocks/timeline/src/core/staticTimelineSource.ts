import { Result } from 'better-result'
import type { TimelineEntry, TimelineSource } from './types'

/** A source over entries already in memory: one page, complete for all time. */
export const staticTimelineSource = <TData>(
    key: string,
    label: string,
    entries: TimelineEntry<TData>[]
): TimelineSource<TData> => ({
    key,
    label,
    fetchPage: async () => Result.ok({ entries: [...entries] }),
})
