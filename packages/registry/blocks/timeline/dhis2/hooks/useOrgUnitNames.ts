import { useDataEngine } from '@dhis2/app-runtime'
import {
    keepPreviousData,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query'
import { fetchOrgUnitNames, shouldRetryRequest } from '../queries'
import { timelineKeys } from '../timelineKeys'

/**
 * Names for org units by id, one request for the whole set (none for an
 * empty one). While another set loads, `data` keeps the last set's names and
 * `isPlaceholderData` is true.
 */
export const useOrgUnitNames = (
    ids: ReadonlyArray<string>,
    { enabled = true }: { enabled?: boolean } = {}
): UseQueryResult<ReadonlyMap<string, string>> => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: timelineKeys.orgUnitNames(ids),
        enabled,
        staleTime: Infinity,
        placeholderData: keepPreviousData,
        retry: shouldRetryRequest,
        queryFn: async ({ signal }): Promise<ReadonlyMap<string, string>> => {
            const names = await fetchOrgUnitNames(engine, { ids }, signal)
            return new Map(
                names.map(({ id, displayName }) => [id, displayName])
            )
        },
    })
}
