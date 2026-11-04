import i18n from '@dhis2/d2-i18n'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { fetchOrgUnitNames } from '../queries'
import { refetchOf, statusOf, unwrap } from '../queryState'
import { timelineKeys } from '../timelineKeys'
import { useTimelineClient } from './useTimelineClient'

const NO_NAMES: ReadonlyMap<string, string> = new Map()

/**
 * Names for org units, one request for the whole set. Waits for `ids`, so
 * entries never show an id that a name is about to replace. While a new set
 * loads, `names` keeps the previous answer and `pending` stays true; a hook
 * already showing a history keeps it on show meanwhile.
 */
export const useOrgUnitNames = (ids: ReadonlyArray<string> | undefined) => {
    const client = useTimelineClient()
    const query = useQuery({
        queryKey: timelineKeys.orgUnitNames(ids ?? []),
        enabled: ids !== undefined && ids.length > 0,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
        queryFn: async ({ signal }: { signal: AbortSignal }) =>
            new Map(
                unwrap(
                    await fetchOrgUnitNames(client, { ids: ids ?? [] }, signal)
                ).map(({ id, displayName }) => [id, displayName])
            ),
    })
    const status = statusOf(query)
    return {
        names: query.data ?? NO_NAMES,
        // The last set's names stand in only once a history is on show: a
        // new person's first answer waits for their own names.
        pending:
            ids === undefined ||
            (ids.length > 0 &&
                (status === 'pending' || query.isPlaceholderData)),
        isFetching: query.isFetching,
        notices:
            status === 'error'
                ? [
                      {
                          id: 'org-units-failed',
                          tone: 'warning' as const,
                          message: i18n.t(
                              "Org unit names couldn't load, so ids are shown."
                          ),
                          retry: refetchOf(query),
                      },
                  ]
                : [],
    }
}
