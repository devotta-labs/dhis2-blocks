import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
    shouldRetryProfileWidgetRequest,
    toProfileWidgetLoadError,
} from '../api/client'
import { isQueryNotDeleted } from '../api/deletedQueries'
import { profileWidgetQueryKeys } from '../api/queryKeys'
import {
    useProfileServerFeatures,
    useProfileWidgetClient,
} from '../api/runtime'
import { useValueFormatter } from '../data/formatting/useValueFormatter'
import type {
    UseTrackedEntityChangelogOptions,
    UseTrackedEntityChangelogResult,
} from '../types'
import {
    changelogFormattableValues,
    formatChangelogEntries,
    prepareChangelogPage,
} from './normalize'
import {
    fetchTrackedEntityChangelog,
    resolveChangelogRequest,
} from './requests'

const OPERATION = 'Load tracked entity changelog'

/** Entity, program: the key parts a page can keep showing while the next loads. */
const SCOPE_KEY_LENGTH = profileWidgetQueryKeys.changelogs('scope').length + 1

const isSameScope = (
    previousKey: readonly (string | number)[],
    nextKey: readonly (string | number)[]
) =>
    nextKey
        .slice(0, SCOPE_KEY_LENGTH)
        .every((part, index) => previousKey[index] === part)

/**
 * `tracker/trackedEntities/{id}/changeLogs`, keyed by
 * `profileWidgetQueryKeys.changelog`. Values go through `useValueFormatter`.
 * `attributeId` and the username/attribute order are 2.42+ only; older
 * servers get the request without them. `refetch` re-requests the current
 * page, and after a lookup failure the file-resource, org-unit and system
 * info lookups as well.
 */
export function useTrackedEntityChangelog(
    options: UseTrackedEntityChangelogOptions
): UseTrackedEntityChangelogResult {
    const client = useProfileWidgetClient()
    const queryClient = useQueryClient()
    const features = useProfileServerFeatures()
    const { attributes } = options
    const request = resolveChangelogRequest(options, features)
    const { trackedEntityId, programId } = request
    const queryKey = profileWidgetQueryKeys.changelog(trackedEntityId, request)

    const query = useQuery({
        queryKey,
        queryFn: ({ signal }) =>
            fetchTrackedEntityChangelog(client, request, signal),
        retry: shouldRetryProfileWidgetRequest,
        // Never refetch a page of a deleted entity that is still on screen.
        enabled: (cached) => isQueryNotDeleted(cached),
        // Keep the current page on screen while the next page, filter or order loads.
        placeholderData: (previous, previousQuery) =>
            previousQuery && isSameScope(previousQuery.queryKey, queryKey)
                ? previous
                : undefined,
    })

    const prepared = useMemo(
        () =>
            query.data
                ? prepareChangelogPage(query.data, attributes, {
                      trackedEntityId,
                      programId,
                  })
                : undefined,
        [query.data, attributes, trackedEntityId, programId]
    )
    const values = useMemo(
        () => (prepared ? changelogFormattableValues(prepared) : undefined),
        [prepared]
    )
    const formatterState = useValueFormatter(values)
    const { formatter } = formatterState

    const data = useMemo(
        () =>
            prepared && formatter
                ? {
                      entries: formatChangelogEntries(prepared, formatter),
                      hasNextPage: prepared.hasNextPage,
                  }
                : undefined,
        [prepared, formatter]
    )
    const loadError = useMemo(
        () =>
            query.error
                ? toProfileWidgetLoadError(query.error, OPERATION, {
                      trackedEntityId,
                      programId,
                  })
                : null,
        [query.error, trackedEntityId, programId]
    )

    // While a new page's file or org-unit names load, the formatter is not
    // ready; keep the last formatted page of the same entity and program on
    // screen, as the query does for the raw page. The page is kept in a ref
    // written after commit, never in state set during render: `data` gets a
    // new identity whenever the caller passes a new `attributes` array, and
    // setting state from that identity would re-render without end.
    const scope = `${trackedEntityId}:${programId ?? ''}`
    const lastPageRef = useRef<{
        scope: string
        data: NonNullable<typeof data>
    } | null>(null)
    useEffect(() => {
        if (data !== undefined) {
            lastPageRef.current = { scope, data }
        }
    }, [data, scope])
    const retained = lastPageRef.current
    const shown =
        data ?? (retained?.scope === scope ? retained.data : undefined)

    const error = loadError ?? formatterState.error
    const formatterError = formatterState.error
    const refetchPage = query.refetch
    const refetch = useCallback(() => {
        void refetchPage()
        if (formatterError) {
            void queryClient.refetchQueries({
                queryKey: profileWidgetQueryKeys.systemInfo(),
                type: 'active',
            })
            void queryClient.refetchQueries({
                queryKey: profileWidgetQueryKeys.lookups(),
                type: 'active',
            })
        }
    }, [refetchPage, formatterError, queryClient])

    if (error) {
        return {
            data: undefined,
            error,
            isPending: false,
            isFetching: query.isFetching,
            refetch,
        }
    }
    return {
        data: shown,
        error: null,
        isPending: shown === undefined,
        isFetching:
            query.isFetching ||
            (prepared !== undefined && formatterState.isPending),
        refetch,
    }
}
