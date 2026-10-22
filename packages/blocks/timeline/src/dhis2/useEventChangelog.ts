import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import { groupChangelogRows, isNotFound, type ChangeGroup } from './changelog'
import { fetchEventChangeLogPage } from './queries'
import type { ChangeLogRow } from './schemas'
import { timelineKeys } from './timelineKeys'
import { useTimelineClient } from './useTimelineClient'

/** Most rows fetched for one event; past it the result is `truncated`. */
const MAX_ROWS = 500
const PAGE_SIZE = 100

export interface EventChangelog {
    status: 'idle' | 'loading' | 'success' | 'unsupported' | 'error'
    groups: ChangeGroup[]
    truncated: boolean
}

const NO_GROUPS: ChangeGroup[] = []

/**
 * The changes saved on one event, newest first, fetched only once `enabled`
 * (when "Show changes" is opened). Fetches pages until the last one or
 * 500 rows. A 404 is `unsupported`.
 */
export const useEventChangelog = (
    event: string,
    { enabled }: { enabled: boolean }
): EventChangelog => {
    const client = useTimelineClient()

    const query = useQuery({
        queryKey: timelineKeys.eventChangeLog(event),
        enabled,
        retry: false,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        queryFn: async ({ signal }) => {
            const rows: ChangeLogRow[] = []
            for (let page = 1; ; page++) {
                const result = await fetchEventChangeLogPage(
                    client,
                    { event, page, pageSize: PAGE_SIZE },
                    signal
                )
                if (Result.isError(result)) {
                    throw result.error
                }
                rows.push(...result.value.rows)
                if (!result.value.hasMore) {
                    return { rows, truncated: false }
                }
                if (rows.length >= MAX_ROWS) {
                    return { rows: rows.slice(0, MAX_ROWS), truncated: true }
                }
            }
        },
    })

    const groups = useMemo(
        () => (query.data ? groupChangelogRows(query.data.rows) : NO_GROUPS),
        [query.data]
    )

    if (query.data) {
        return { status: 'success', groups, truncated: query.data.truncated }
    }
    if (query.error) {
        return {
            status: isNotFound(query.error) ? 'unsupported' : 'error',
            groups: NO_GROUPS,
            truncated: false,
        }
    }
    return {
        status: query.fetchStatus === 'idle' ? 'idle' : 'loading',
        groups: NO_GROUPS,
        truncated: false,
    }
}
