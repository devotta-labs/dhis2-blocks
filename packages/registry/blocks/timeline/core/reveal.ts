import { storedDay } from '@/components/dhis2-value-display/calendar'
import { compareEntries } from './sort'
import type { TimelineEntry } from './types'

export interface Revealed<TData> {
    entries: TimelineEntry<TData>[]
    /** Past entries held back. */
    hidden: number
}

export interface RevealOptions {
    /** How many past entries to show, newest first. */
    count: number
    /** The current day, `YYYY-MM-DD`. */
    today: string
}

const isPast = (entry: TimelineEntry<unknown>, today: string) => {
    if (entry.phase !== undefined) {
        return entry.phase === 'past'
    }
    const day = storedDay(entry.at)
    // Undated entries count as past: they are listed last.
    return day === undefined || day <= today
}

/**
 * Every future and overdue entry, and the newest `count` past entries. Future
 * and overdue entries are what follow-up work needs, so they are never held
 * back; `hidden` is how many past entries were.
 */
export const revealPast = <TData>(
    entries: ReadonlyArray<TimelineEntry<TData>>,
    { count, today }: RevealOptions
): Revealed<TData> => {
    const past = entries.filter((entry) => isPast(entry, today))
    if (past.length <= count) {
        return { entries: [...entries], hidden: 0 }
    }
    const shown = new Set(
        [...past].sort(compareEntries('desc')).slice(0, count)
    )
    return {
        entries: entries.filter(
            (entry) => !isPast(entry, today) || shown.has(entry)
        ),
        hidden: past.length - count,
    }
}
