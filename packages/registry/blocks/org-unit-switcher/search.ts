import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { shouldRetryOrgUnitRequest } from './api/client'
import { FRESH_MS, searchOrgUnits, unwrap } from './api/queries'
import { orgUnitQueryKeys } from './api/queryKeys'
import type { OrgUnit } from './api/schemas'
import { isWithinAssigned } from './api/scope'
import { useOrgUnitContext } from './provider/context'

const SEARCH_DELAY_MS = 250

const MAX_UNFILTERED = 8
const noop = () => {}

export interface OrgUnitSearch {
    /** Whether the menu needs a search box at all. */
    searchable: boolean
    /** Whether search asks the server, rather than filtering the assigned list. */
    searchesServer: boolean
    query: string
    setQuery: (query: string) => void
    /** Asks for the hierarchy's first page, once the menu is first opened. */
    browse: () => void
    status: 'pending' | 'ready' | 'failed'
    /** Every page loaded so far; with a blank query, the user's whole hierarchy by name. */
    orgUnits: OrgUnit[]
    hasMore: boolean
    loadingMore: boolean
    /** The last try for the next page failed. */
    moreFailed: boolean
    loadMore: () => void
    retry: () => void
}

/** The selector's search: held in the selector, so typing re-renders only the menu. */
export const useOrgUnitSearch: () => OrgUnitSearch = () => {
    const { state, source } = useOrgUnitContext()
    const { assigned } = state
    const { client, cacheId, userId } = source
    const searchesServer = assigned.some((a) => a.hasChildren)
    const searchable = searchesServer || assigned.length > MAX_UNFILTERED

    const [query, setQuery] = useState('')
    const [browsed, setBrowsed] = useState(false)
    const browse = useCallback(() => setBrowsed(true), [])
    const trimmed = query.trim()
    const [debounced, setDebounced] = useState('')
    useEffect(() => {
        const timeout = setTimeout(() => setDebounced(trimmed), SEARCH_DELAY_MS)
        return () => clearTimeout(timeout)
    }, [trimmed])

    const server = useInfiniteQuery({
        queryKey: orgUnitQueryKeys.search(cacheId, userId ?? '', debounced),
        queryFn: async ({ pageParam, signal }) =>
            unwrap(await searchOrgUnits(client, debounced, pageParam, signal)),
        initialPageParam: 1,
        getNextPageParam: (last, pages) =>
            last.hasMore ? pages.length + 1 : undefined,

        enabled:
            searchesServer &&
            userId !== undefined &&
            (browsed || debounced !== ''),
        retry: shouldRetryOrgUnitRequest,
        staleTime: FRESH_MS,
    })

    const base = { searchable, searchesServer, query, setQuery, browse }
    const none = { hasMore: false, loadingMore: false, moreFailed: false }
    if (!searchesServer) {
        const lower = trimmed.toLowerCase()
        return {
            ...base,
            ...none,
            status: 'ready',
            orgUnits: assigned.filter((a) =>
                a.displayName.toLowerCase().includes(lower)
            ),
            loadMore: noop,
            retry: noop,
        }
    }
    const retry = () => void server.refetch()
    if (debounced !== trimmed || server.isPending) {
        return {
            ...base,
            ...none,
            status: 'pending',
            orgUnits: [],
            loadMore: noop,
            retry,
        }
    }
    if (server.data === undefined) {
        return {
            ...base,
            ...none,
            status: 'failed',
            orgUnits: [],
            loadMore: noop,
            retry,
        }
    }

    const loaded = new Map(
        server.data.pages
            .flatMap((page) => page.orgUnits)

            .filter((c) => isWithinAssigned(c.path, assigned))
            .map((c) => [c.id, c])
    )
    return {
        ...base,
        status: 'ready',
        orgUnits: [...loaded.values()],
        hasMore: server.hasNextPage,
        loadingMore: server.isFetchingNextPage,
        moreFailed: server.isFetchNextPageError,

        loadMore: () => void server.fetchNextPage({ cancelRefetch: false }),
        retry,
    }
}
