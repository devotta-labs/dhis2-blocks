import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { groupChangelogRows, isNotFound } from './changelog'
import { fetchEventChangeLog } from './queries'
import { timelineKeys } from './timelineKeys'
import type { ChangeSave, StageInfo } from './types'
import { unwrap } from './useHistoryQueries'
import { useTimelineClient } from './useTimelineClient'

/** Most rows fetched for one event; past it the result is `truncated`. */
const MAX_ROWS = 500

export interface EventChangelog {
    status: 'idle' | 'loading' | 'success' | 'unsupported' | 'error'
    saves: ChangeSave[]
    truncated: boolean
}

const NO_SAVES: ChangeSave[] = []

/**
 * The changes saved on one event, newest first, with data element labels
 * from its `stage`. Fetched only once `enabled` (when "Show changes" is
 * opened), up to 500 rows. A 404 is `unsupported`.
 */
export const useEventChangelog = (
    event: string,
    { enabled, stage }: { enabled: boolean; stage?: StageInfo }
): EventChangelog => {
    const client = useTimelineClient()

    const query = useQuery({
        queryKey: timelineKeys.eventChangeLog(event),
        enabled,
        retry: (failures: number, error: Error) =>
            !isNotFound(error) && failures < 3,
        queryFn: async ({ signal }) =>
            unwrap(
                await fetchEventChangeLog(
                    client,
                    { event, maxRows: MAX_ROWS },
                    signal
                )
            ),
    })

    const saves = useMemo(
        () =>
            query.data
                ? groupChangelogRows(query.data.rows, (field) =>
                      field.kind === 'dataElement'
                          ? stage?.dataElements.get(field.id)
                          : undefined
                  )
                : NO_SAVES,
        [query.data, stage]
    )

    if (query.data) {
        return { status: 'success', saves, truncated: query.data.truncated }
    }
    if (query.error) {
        return {
            status: isNotFound(query.error) ? 'unsupported' : 'error',
            saves: NO_SAVES,
            truncated: false,
        }
    }
    return {
        status: query.fetchStatus === 'idle' ? 'idle' : 'loading',
        saves: NO_SAVES,
        truncated: false,
    }
}
