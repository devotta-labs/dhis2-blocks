import { useInfiniteQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { shouldRetryClinicRequest } from './api/client'
import { FRESH_MS, searchClinics, unwrap } from './api/queries'
import { clinicQueryKeys } from './api/queryKeys'
import type { Clinic } from './api/schemas'
import { isWithinAssigned } from './api/scope'
import { useClinicContext } from './provider/context'

const SEARCH_DELAY_MS = 250
// More than this many facilities is too many to scan without a filter.
const MAX_UNFILTERED = 8
const noop = () => {}

export interface ClinicSearch {
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
    clinics: Clinic[]
    hasMore: boolean
    loadingMore: boolean
    /** The last try for the next page failed. */
    moreFailed: boolean
    loadMore: () => void
    retry: () => void
}

/** The selector's search: held in the selector, so typing re-renders only the menu. */
export function useClinicSearch(): ClinicSearch {
    const { state, source } = useClinicContext()
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

    // A blank query pages through the whole hierarchy, so the menu can be browsed without typing.
    const server = useInfiniteQuery({
        queryKey: clinicQueryKeys.search(cacheId, userId ?? '', debounced),
        queryFn: async ({ pageParam, signal }) =>
            unwrap(await searchClinics(client, debounced, pageParam, signal)),
        initialPageParam: 1,
        getNextPageParam: (last, pages) =>
            last.hasMore ? pages.length + 1 : undefined,
        // Nothing is asked for until the menu is opened or the user types.
        enabled:
            searchesServer &&
            userId !== undefined &&
            (browsed || debounced !== ''),
        retry: shouldRetryClinicRequest,
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
            clinics: assigned.filter((a) =>
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
            clinics: [],
            loadMore: noop,
            retry,
        }
    }
    if (server.data === undefined) {
        return {
            ...base,
            ...none,
            status: 'failed',
            clinics: [],
            loadMore: noop,
            retry,
        }
    }
    // By id, so a clinic that moved between pages while they loaded shows once.
    const loaded = new Map(
        server.data.pages
            .flatMap((page) => page.clinics)
            // A server that ignores the scope filter must not list clinics a pick would drop.
            .filter((c) => isWithinAssigned(c.path, assigned))
            .map((c) => [c.id, c])
    )
    return {
        ...base,
        status: 'ready',
        clinics: [...loaded.values()],
        hasMore: server.hasNextPage,
        loadingMore: server.isFetchingNextPage,
        moreFailed: server.isFetchNextPageError,
        // A second press while the page loads joins it rather than starting over.
        loadMore: () => void server.fetchNextPage({ cancelRefetch: false }),
        retry,
    }
}
