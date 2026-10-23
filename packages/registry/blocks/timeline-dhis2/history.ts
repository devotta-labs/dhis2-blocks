import type {
    TimelineEntry,
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

/** The entries of several histories, or none while `status` is pending. */
export const mergeEntries = <TData>(
    status: TimelineStatus,
    lists: ReadonlyArray<ReadonlyArray<TimelineEntry<TData>>>
): ReadonlyArray<TimelineEntry<TData>> =>
    status === 'pending' ? NO_ENTRIES : lists.flat()

/**
 * Several histories as one: their entries and notices together, with one
 * status. Nothing is shown until every history has answered once, so entries
 * never shift about while the first answers arrive; after that, a refetch
 * keeps what is on screen until its answer replaces it. To show some
 * histories without waiting for the rest, see `addWhenReady`.
 */
export const mergeHistory = <TData>(
    ...results: ReadonlyArray<HistoryResult<TData>>
): HistoryResult<TData> => {
    const status = combineStatus(results.map((result) => result.status))
    return {
        entries: mergeEntries(
            status,
            results.map((result) => result.entries)
        ),
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

/**
 * `history` with `parts` added without waiting for them: while a part has
 * not answered once, `history` shows on its own, and the part's entries join
 * it when they arrive. For parts slower than they are worth waiting for,
 * such as attribute changes, whose changelog is read a page at a time.
 */
export const addWhenReady = <TData>(
    history: HistoryResult<TData>,
    ...parts: ReadonlyArray<HistoryResult<TData>>
): HistoryResult<TData> =>
    mergeHistory(
        history,
        ...parts.map((part) =>
            part.status === 'pending'
                ? { ...part, status: history.status }
                : part
        )
    )
