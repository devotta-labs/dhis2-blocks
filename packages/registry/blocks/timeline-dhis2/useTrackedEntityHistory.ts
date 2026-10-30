import { useMemo } from 'react'
import { addWhenReady, mergeEntries, mergeHistory } from './history'
import type { EventTimeField } from './queries'
import type { HistoryEntryData, HistoryResult } from './types'
import { useAttributeChangeEntries } from './useAttributeChangeEntries'
import { useEnrollmentEntries } from './useEnrollmentEntries'
import { useEventEntries } from './useEventEntries'

export interface TrackedEntityHistoryOptions {
    trackedEntity: string
    /** Defaults to every program the tracked entity is enrolled in. */
    programs?: ReadonlyArray<string>
    timeField: EventTimeField
    /** Most events read per program. */
    cap?: number
    /** The current moment; for tests. */
    now?: Date
}

/**
 * A person's history: events, enrollment milestones and notes, and attribute
 * changes, in every program they are enrolled in (or `programs`). Events and
 * enrollments show together; attribute changes join them when they arrive,
 * since a changelog is read a page at a time. Compose the three hooks
 * yourself with `mergeHistory` and `addWhenReady` to leave a kind out or
 * wait for every part.
 */
export const useTrackedEntityHistory = ({
    trackedEntity,
    programs,
    timeField,
    cap,
    now,
}: TrackedEntityHistoryOptions): HistoryResult<HistoryEntryData> => {
    const events = useEventEntries({
        trackedEntity,
        programs,
        timeField,
        cap,
        now,
    })
    const enrollments = useEnrollmentEntries({ trackedEntity, programs })
    const changes = useAttributeChangeEntries({ trackedEntity, programs })
    const merged = addWhenReady(
        mergeHistory<HistoryEntryData>(events, enrollments),
        changes
    )
    // One array per change of the parts, so the timeline regroups only then.
    const entries = useMemo(
        () =>
            mergeEntries<HistoryEntryData>(merged.status, [
                events.entries,
                enrollments.entries,
                changes.entries,
            ]),
        [merged.status, events.entries, enrollments.entries, changes.entries]
    )
    return { ...merged, entries }
}
