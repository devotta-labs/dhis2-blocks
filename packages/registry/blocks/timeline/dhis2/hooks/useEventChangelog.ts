import { useDataEngine } from '@dhis2/app-runtime'
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import { useCallback } from 'react'
import { groupChangelogRows } from '../changelog'
import { fetchEventChangeLog, type ChangeLogResult } from '../queries'
import { timelineKeys } from '../timelineKeys'
import type { ChangeSave, StageInfo } from '../types'

export interface EventChangelog {
    /** Newest first. */
    saves: ChangeSave[]
    /** More than 500 rows exist; the oldest were left out. */
    truncated: boolean
    /** The server has no changelog endpoint: it answered 404. */
    unsupported: boolean
}

/**
 * The changes saved on one event, with data element labels from its `stage`.
 * Fetched only once `enabled` (when "Show changes" is opened).
 */
export const useEventChangelog = (
    event: string,
    { enabled, stage }: { enabled: boolean; stage?: StageInfo }
): UseQueryResult<EventChangelog> => {
    const engine = useDataEngine()
    const select = useCallback(
        ({ rows, truncated, unsupported }: ChangeLogResult) => ({
            saves: groupChangelogRows(rows, (field) =>
                field.kind === 'dataElement'
                    ? stage?.dataElements.get(field.id)
                    : undefined
            ),
            truncated,
            unsupported,
        }),
        [stage]
    )
    return useQuery({
        queryKey: timelineKeys.eventChangeLog(event),
        enabled,
        // A failure shows its error at once; opening the changes again retries.
        retry: false,
        queryFn: ({ signal }) => fetchEventChangeLog(engine, { event }, signal),
        select,
    })
}
