import { Result } from 'better-result'
import type { TimelineEntry, TimelineSource } from './types'

interface StaticTimelineSourceOptions {
    /** Change it to show new `entries`; the old ones stay until then. */
    revision?: unknown
    /** Change it when the entries are about something else; the old ones go at once. */
    subject?: string
}

/** A source over entries already in memory: one page, complete for all time. */
export const staticTimelineSource = <TData>(
    key: string,
    label: string,
    entries: TimelineEntry<TData>[],
    { revision, subject }: StaticTimelineSourceOptions = {}
): TimelineSource<TData> => ({
    key,
    label,
    revision,
    subject,
    fetchPage: async () => Result.ok({ entries: [...entries] }),
})
