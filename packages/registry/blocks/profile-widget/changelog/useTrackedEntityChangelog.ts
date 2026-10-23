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

const SCOPE_KEY_LENGTH = profileWidgetQueryKeys.changelogs('scope').length + 1

const isSameScope = (
    previousKey: readonly (string | number)[],
    nextKey: readonly (string | number)[]
) =>
    nextKey
        .slice(0, SCOPE_KEY_LENGTH)
        .every((part, index) => previousKey[index] === part)

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
        enabled: (cached) => isQueryNotDeleted(cached),
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
