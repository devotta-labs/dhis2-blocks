import { storedDay } from '@/components/dhis2-value-display/calendar'
import type { TimelineEntry, TimelinePhase } from './types'

/** An unreadable stored day is undated, regardless of an explicit phase. */
export const classifyEntry = (
    entry: Pick<TimelineEntry, 'at' | 'phase'>,
    today: string
) => {
    const day = storedDay(entry.at)
    return {
        day,
        phase:
            day === undefined
                ? 'undated'
                : (entry.phase ?? (day > today ? 'future' : 'past')),
    } satisfies { day?: string; phase: TimelinePhase | 'undated' }
}
