import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import {
    isForbidden,
    shouldRetryTrackedEntityHeaderRequest,
} from '../../api/client'
import {
    fetchRelationships,
    fetchRelationshipTypes,
    fetchViewAttributes,
} from '../../api/relationships'
import {
    METADATA_STALE_TIME,
    trackedEntityHeaderQueryKeys as keys,
} from '../../api/queryKeys'
import type { RelationshipTypeMeta } from '../../api/types'
import { useHeaderContext } from '../../provider/context'
import {
    resolveRelationships,
    type RelationshipGroup,
    type RelationshipLabel,
} from './resolve'

export type RelationshipsState =
    | { kind: 'hidden' }
    | { kind: 'loading' }
    | { kind: 'unavailable' }
    | {
          kind: 'ready'
          groups: RelationshipGroup[]
          /** Metadata of the types the groups and the registered parts name. */
          types: Map<string, RelationshipTypeMeta>
      }

/** Unwraps a Result so React Query owns the error state. */
const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const EMPTY: string[] = []

/** The record's relationships, resolved into labelled groups. Parts share its three queries through the cache. The types parts have registered are fetched with the linked ones, so a type with no link can still be named. */
export const useRelationships = (
    labels?: Readonly<Record<string, RelationshipLabel>>
): RelationshipsState => {
    const { state, resourceClient, clientId, display, relationshipTypes } =
        useHeaderContext()
    const id = state.status === 'ready' ? state.trackedEntity.id : undefined

    const relationships = useQuery({
        queryKey: keys.relationships(clientId, id ?? ''),
        queryFn: async ({ signal }) =>
            unwrap(await fetchRelationships(resourceClient, id ?? '', signal)),
        enabled: id !== undefined,
        retry: shouldRetryTrackedEntityHeaderRequest,
    })

    const linkedTypes = useMemo(
        () =>
            relationships.data
                ? [...new Set(relationships.data.map(({ type }) => type))]
                : EMPTY,
        [relationships.data]
    )
    // The same union for every part, so they share one request.
    const typeIds = useMemo(
        () =>
            relationships.data
                ? [...new Set([...linkedTypes, ...relationshipTypes])].sort()
                : EMPTY,
        [relationships.data, linkedTypes, relationshipTypes]
    )
    const types = useQuery({
        queryKey: keys.relationshipTypes(clientId, typeIds),
        queryFn: async ({ signal }) =>
            unwrap(
                await fetchRelationshipTypes(resourceClient, typeIds, signal)
            ),
        enabled: typeIds.length > 0,
        retry: shouldRetryTrackedEntityHeaderRequest,
        staleTime: METADATA_STALE_TIME,
    })

    const viewIds = useMemo(
        () =>
            types.data
                ? [
                      ...new Set(
                          linkedTypes.flatMap((type) => {
                              const ends = types.data.get(type)?.ends
                              return ends
                                  ? [...ends.from.view, ...ends.to.view]
                                  : []
                          })
                      ),
                  ]
                : EMPTY,
        [types.data, linkedTypes]
    )
    const attributes = useQuery({
        queryKey: keys.viewAttributes(clientId, viewIds),
        queryFn: async ({ signal }) =>
            unwrap(await fetchViewAttributes(resourceClient, viewIds, signal)),
        enabled: viewIds.length > 0,
        retry: shouldRetryTrackedEntityHeaderRequest,
        staleTime: METADATA_STALE_TIME,
    })

    const records = relationships.data
    const typeData = types.data
    const attributeData = attributes.data
    const groups = useMemo(
        () =>
            records &&
            resolveRelationships({
                records,
                types: typeData ?? new Map(),
                attributes: attributeData ?? new Map(),
                display,
                labels,
            }),
        [records, typeData, attributeData, display, labels]
    )

    if (id === undefined) {
        return { kind: 'hidden' }
    }
    // A failed refresh keeps what is already shown, unless the server now refuses: revoked access shows nothing.
    const failed = (query: { error: Error | null; data: unknown }) =>
        query.error !== null &&
        (query.data === undefined || isForbidden(query.error))
    if (failed(relationships) || failed(types) || failed(attributes)) {
        return { kind: 'unavailable' }
    }
    if (
        !groups ||
        (typeIds.length > 0 && !typeData) ||
        (viewIds.length > 0 && !attributeData)
    ) {
        return { kind: 'loading' }
    }
    return { kind: 'ready', groups, types: typeData ?? new Map() }
}
