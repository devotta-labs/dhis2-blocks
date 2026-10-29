import {
    hashKey,
    skipToken,
    useQuery,
    useQueryClient,
    type QueryClient,
    type QueryKey,
} from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import {
    shouldRetryRelationshipRequest,
    type RelationshipViewerClient,
} from '../api/client'
import {
    fetchNodeRecord,
    fetchRelationshipMetadata,
    fetchSeedPage,
    type SeedQuery,
} from '../api/fetchers'
import { relationshipViewerKeys } from '../api/keys'
import {
    parseNodeKey,
    type FetchRecord,
    type NodeKey,
    type NodeRef,
} from '../domain/model'
import { traverse } from '../domain/traverse'
import type {
    RelationshipGraphResult,
    RelationshipViewerSeeds,
    RelationshipViewerStatus,
} from './contracts'
import { useRuntimeRelationshipViewerClient } from './engineAdapter'

const STALE_TIME = 5 * 60_000
const NODE_GC_TIME = 30 * 60_000
const CONCURRENCY = 6

const nodeQuery = (
    client: RelationshipViewerClient,
    ref: NodeRef,
    program: string | undefined
) => ({
    queryKey: relationshipViewerKeys.node(ref, program),
    queryFn: ({ signal }: { signal: AbortSignal }) =>
        fetchNodeRecord(client, ref, program, signal),
    gcTime: NODE_GC_TIME,
    retry: shouldRetryRelationshipRequest,
})

/** Pages seed refs; traversal fetches each seed like any other node. */
async function loadSeedRefs(
    client: RelationshipViewerClient,
    query: SeedQuery,
    cap: number,
    signal: AbortSignal
): Promise<NodeRef[]> {
    const refs: NodeRef[] = []
    // Page one past the cap so traversal refuses a seed and reports the graph as capped.
    for (let page = 1, more = true; more && refs.length <= cap; page++) {
        const result = await fetchSeedPage(client, query, page, signal)
        refs.push(...result.refs)
        more = result.hasMore
    }
    return refs.slice(0, cap + 1)
}

/** Reads known records from the cache however old; only unknown nodes are fetched. */
const cachedFetchRecord =
    (
        client: RelationshipViewerClient,
        queryClient: QueryClient,
        program: string | undefined
    ): FetchRecord =>
    (ref) => {
        const query = nodeQuery(client, ref, program)
        // A failed node stays failed until retry removes its query.
        const cached = queryClient.getQueryState(query.queryKey)
        if (cached?.status === 'error') {
            return Promise.reject(cached.error)
        }
        return queryClient.ensureQueryData({
            ...query,
            revalidateIfStale: false,
        })
    }

const effectiveProgram = (
    program: string | undefined,
    seedQuery: SeedQuery | undefined
): string | undefined => {
    // An empty program is unset.
    const given = program || undefined
    if (given && seedQuery && given !== seedQuery.program) {
        throw new Error(
            `RelationshipViewer received program "${given}" but its seed query reads program "${seedQuery.program}". Pass one program for both.`
        )
    }
    return given ?? (seedQuery?.program || undefined)
}

export function useRelationshipGraph({
    seeds,
    program: programOption,
    hops,
    cap,
    followTypes,
}: {
    seeds: RelationshipViewerSeeds
    program?: string
    hops: number
    cap: number
    followTypes?: readonly string[]
}): RelationshipGraphResult {
    const client = useRuntimeRelationshipViewerClient()
    const queryClient = useQueryClient()
    const [expanded, setExpanded] = useState<ReadonlySet<NodeKey>>(new Set())
    const [nonce, setNonce] = useState(0)
    const seedQuery = 'query' in seeds ? seeds.query : undefined
    const program = effectiveProgram(programOption, seedQuery)

    const metadata = useQuery({
        queryKey: relationshipViewerKeys.metadata(),
        queryFn: ({ signal }) => fetchRelationshipMetadata(client, signal),
        staleTime: STALE_TIME,
        retry: shouldRetryRelationshipRequest,
    })

    const seedPages = useQuery({
        queryKey: [
            ...(seedQuery
                ? relationshipViewerKeys.seeds(seedQuery)
                : relationshipViewerKeys.all),
            cap,
        ],
        queryFn: seedQuery
            ? ({ signal }) => loadSeedRefs(client, seedQuery, cap, signal)
            : skipToken,
        staleTime: STALE_TIME,
        retry: shouldRetryRelationshipRequest,
    })

    const seedRefs: readonly NodeRef[] | undefined =
        'refs' in seeds ? seeds.refs : seedPages.data

    const baseKey: QueryKey = [
        ...relationshipViewerKeys.all,
        'graph',
        seedRefs,
        program ?? null,
        hops,
        cap,
        followTypes ?? null,
    ]
    const graph = useQuery({
        queryKey: [...baseKey, [...expanded].sort(), nonce],
        queryFn: seedRefs
            ? () =>
                  traverse(
                      seedRefs,
                      cachedFetchRecord(client, queryClient, program),
                      {
                          hops,
                          cap,
                          concurrency: CONCURRENCY,
                          followTypes: followTypes && new Set(followTypes),
                          expanded,
                      }
                  )
            : skipToken,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        // Keep the drawn graph only while expanding or retrying; a new base loads from blank.
        placeholderData: (previous, previousQuery) =>
            previousQuery &&
            hashKey(previousQuery.queryKey.slice(0, baseKey.length)) ===
                hashKey(baseKey)
                ? previous
                : undefined,
    })

    const expand = useCallback(
        (key: NodeKey) =>
            setExpanded((current) =>
                current.has(key) ? current : new Set(current).add(key)
            ),
        []
    )

    const { refetch: refetchMetadata, isError: metadataFailed } = metadata
    const { refetch: refetchSeeds, isError: seedsFailed } = seedPages
    const retry = useCallback(
        (key?: NodeKey) => {
            if (metadataFailed) void refetchMetadata()
            if (seedsFailed) void refetchSeeds()
            queryClient.removeQueries(
                key
                    ? {
                          queryKey: relationshipViewerKeys.node(
                              parseNodeKey(key),
                              program
                          ),
                          exact: true,
                      }
                    : {
                          queryKey: [...relationshipViewerKeys.all, 'node'],
                          predicate: (query) => query.state.status === 'error',
                      }
            )
            setNonce((n) => n + 1)
        },
        [
            metadataFailed,
            seedsFailed,
            refetchMetadata,
            refetchSeeds,
            queryClient,
            program,
        ]
    )

    // Per-node failures live on the graph's nodes; only metadata and seed failures fail the graph.
    const error = metadata.error ?? seedPages.error ?? undefined
    let status: RelationshipViewerStatus = 'loading'
    if (error !== undefined) {
        status = 'error'
    } else if (metadata.data && graph.data) {
        status = 'ready'
    }

    return {
        status,
        error,
        graph: graph.data,
        metadata: metadata.data,
        program,
        expand,
        retry,
    }
}
