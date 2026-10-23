import type {
    TimelineNotice,
    TimelineStatus,
} from '@/components/timeline/core/types'
import type { HistoryResult } from './types'

/** What a history shows while it waits for its first answers. */
export const NO_ENTRIES: ReadonlyArray<never> = []

/** The first notice of each id: hooks that share a request repeat its notice. */
const uniqueNotices = (
    notices: ReadonlyArray<TimelineNotice>
): TimelineNotice[] => {
    const seen = new Set<string>()
    return notices.filter((notice) => {
        if (seen.has(notice.id)) {
            return false
        }
        seen.add(notice.id)
        return true
    })
}

/**
 * The status of a history made of parts: `pending` while any part has not
 * answered once, `error` when every part failed, otherwise `success`.
 */
export const combineStatus = (
    statuses: ReadonlyArray<TimelineStatus>
): TimelineStatus => {
    if (statuses.some((status) => status === 'pending')) {
        return 'pending'
    }
    if (statuses.length > 0 && statuses.every((status) => status === 'error')) {
        return 'error'
    }
    return 'success'
}

/**
 * Several histories as one: their entries and notices together, with one
 * status. Nothing is shown until every history has answered once, so entries
 * never shift about while the first answers arrive; after that, a refetch
 * keeps what is on screen until its answer replaces it.
 */
export const mergeHistory = <TData>(
    ...results: ReadonlyArray<HistoryResult<TData>>
): HistoryResult<TData> => {
    const status = combineStatus(results.map((result) => result.status))
    return {
        entries:
            status === 'pending'
                ? NO_ENTRIES
                : results.flatMap((result) => result.entries),
        status,
        notices: uniqueNotices(results.flatMap((result) => result.notices)),
        isFetching: results.some((result) => result.isFetching),
        refetch: () => {
            for (const result of results) {
                result.refetch()
            }
        },
    }
}
