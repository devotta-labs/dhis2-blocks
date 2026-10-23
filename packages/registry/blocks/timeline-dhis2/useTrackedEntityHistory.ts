import { useMemo } from 'react'
import { mergeHistory } from './history'
import type { EventTimeField } from './queries'
import type { Dhis2EntryData, HistoryResult } from './types'
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
 * changes, in every program they are enrolled in (or `programs`). Compose
 * the three hooks yourself with `mergeHistory` to leave a kind out.
 */
export const useTrackedEntityHistory = ({
    trackedEntity,
    programs,
    timeField,
    cap,
    now,
}: TrackedEntityHistoryOptions): HistoryResult<Dhis2EntryData> => {
    const events = useEventEntries({
        trackedEntity,
        programs,
        timeField,
        cap,
        now,
    })
    const enrollments = useEnrollmentEntries({ trackedEntity, programs })
    const changes = useAttributeChangeEntries({ trackedEntity, programs })
    const merged = mergeHistory<Dhis2EntryData>(events, enrollments, changes)
    // One array per change of the parts, so the timeline regroups only then.
    const entries = useMemo(
        () => merged.entries,
        // oxlint-disable-next-line react-hooks/exhaustive-deps
        [events.entries, enrollments.entries, changes.entries, merged.status]
    )
    return { ...merged, entries }
}
