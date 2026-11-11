import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { useConfig } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
} from 'react'
import {
    cacheIdOf,
    isForbidden,
    isNotFound,
    resourceClientOf,
    shouldRetryTrackedEntityHeaderRequest,
    type TrackedEntityHeaderClient,
} from '../api/client'
import { fetchAttributeMetadata, fetchTrackedEntity } from '../api/queries'
import {
    METADATA_STALE_TIME,
    trackedEntityHeaderQueryKeys,
} from '../api/queryKeys'
import { useTrackedEntityHeaderClient } from '../api/runtimeClient'
import { displayLocale } from '../format/display'
import {
    HeaderContext,
    type HeaderContextValue,
    type TrackedEntityHeaderState,
} from './context'

export interface TrackedEntityHeaderProviderProps {
    /** The tracked entity the banner shows. */
    trackedEntity: string
    /** The program whose attributes, enrollment and owner the banner shows; without one, the tracked entity type's. */
    program?: string
    /** A custom data engine's client; app-runtime's is the default. */
    client?: TrackedEntityHeaderClient
    children?: ReactNode
}

/** Unwraps a Result so React Query owns the error state. */
const unwrap = <T,>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

/** A blank program is no program. */
const normaliseProgram = (program: string | undefined) =>
    program?.trim() || undefined

/** The system calendar and the user's locale, for every date and number shown. */
const useDisplayOptions = (): HeaderContextValue['display'] => {
    const { systemInfo } = useConfig()
    // `calendar` is in every server's systemInfo, though app-runtime's type leaves it out.
    const calendar = parseDhis2Calendar(
        systemInfo && 'calendar' in systemInfo ? systemInfo.calendar : undefined
    )
    const locale = displayLocale()
    return useMemo(() => ({ calendar, locale }), [calendar, locale])
}

const MISSING_ID =
    'TrackedEntityHeaderProvider needs a trackedEntity id; it shows loading until it has one'

const HeaderScope = ({
    trackedEntity,
    program,
    client,
    children,
}: TrackedEntityHeaderProviderProps) => {
    const runtimeClient = useTrackedEntityHeaderClient()
    const chosen = client ?? runtimeClient
    const resourceClient = useMemo(() => resourceClientOf(chosen), [chosen])
    const clientId = cacheIdOf(chosen)
    const teId = trackedEntity.trim()
    const progId = normaliseProgram(program)
    const display = useDisplayOptions()

    const entity = useQuery({
        queryKey: trackedEntityHeaderQueryKeys.trackedEntity(
            clientId,
            teId,
            progId
        ),
        queryFn: async ({ signal }) =>
            unwrap(
                await fetchTrackedEntity(
                    resourceClient,
                    { trackedEntity: teId, program: progId },
                    signal
                )
            ),
        enabled: teId !== '',
        retry: shouldRetryTrackedEntityHeaderRequest,
    })
    // Without a program, the tracked entity type says which attributes there are.
    const type = entity.data?.type
    const metadata = useQuery({
        queryKey: trackedEntityHeaderQueryKeys.attributeMetadata(
            clientId,
            progId ?? { type: type ?? '' }
        ),
        queryFn: async ({ signal }) =>
            unwrap(
                await fetchAttributeMetadata(
                    resourceClient,
                    progId === undefined
                        ? { trackedEntityType: type ?? '' }
                        : { program: progId },
                    signal
                )
            ),
        enabled: teId !== '' && (progId !== undefined || type !== undefined),
        retry: shouldRetryTrackedEntityHeaderRequest,
        staleTime: METADATA_STALE_TIME,
    })

    const { refetch: refetchEntity } = entity
    const { refetch: refetchMetadata } = metadata
    const entityFailed = entity.isError
    const metadataFailed = metadata.isError
    const retry = useCallback(() => {
        if (entityFailed) {
            void refetchEntity()
        }
        if (metadataFailed) {
            void refetchMetadata()
        }
    }, [entityFailed, metadataFailed, refetchEntity, refetchMetadata])

    const entityData = entity.data
    const metadataData = metadata.data
    // A refetch that fails keeps what loaded, unless access was withdrawn.
    const blocking = (error: Error | null, loaded: boolean) =>
        error && (!loaded || isForbidden(error)) ? error : null
    const entityError = blocking(entity.error, entityData !== undefined)
    const metadataError = blocking(metadata.error, metadataData !== undefined)
    const state = useMemo((): TrackedEntityHeaderState => {
        const errors = [entityError, metadataError].filter(
            (error): error is Error => error !== null
        )
        // Restricted outranks failed: the record can't be shown however the other request went.
        if (errors.some(isForbidden)) {
            return { status: 'restricted', retry }
        }
        // Asked for again without the program and still missing: there is no such record.
        if (entityError && isNotFound(entityError)) {
            return { status: 'not-found', retry }
        }
        if (errors.length > 0) {
            return { status: 'failed', retry }
        }
        if (!entityData || !metadataData) {
            return { status: 'loading', retry }
        }
        return {
            status: 'ready',
            retry,
            trackedEntity: entityData,
            metadata: metadataData,
        }
    }, [entityError, metadataError, entityData, metadataData, retry])

    const logged = useRef(new Set<string>())
    const logProblem = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    useEffect(() => {
        if (teId === '') {
            logProblem(MISSING_ID)
        }
    }, [teId, logProblem])

    const [counts, setCounts] = useState<ReadonlyMap<string, number>>(
        () => new Map()
    )
    const [typeCounts, setTypeCounts] = useState<ReadonlyMap<string, number>>(
        () => new Map()
    )
    const placeAttribute = useMemo(() => countedPlacement(setCounts), [])
    const placeRelationshipType = useMemo(
        () => countedPlacement(setTypeCounts),
        []
    )
    const placed = useMemo<ReadonlySet<string>>(
        () => new Set(counts.keys()),
        [counts]
    )
    const relationshipTypes = useMemo<ReadonlySet<string>>(
        () => new Set(typeCounts.keys()),
        [typeCounts]
    )

    const value = useMemo<HeaderContextValue>(
        () => ({
            state,
            resourceClient,
            clientId,
            program: progId,
            programName: metadataData?.programName,
            display,
            logProblem,
            placeAttribute,
            placed,
            placeRelationshipType,
            relationshipTypes,
        }),
        [
            state,
            resourceClient,
            clientId,
            progId,
            metadataData,
            display,
            logProblem,
            placeAttribute,
            placed,
            placeRelationshipType,
            relationshipTypes,
        ]
    )

    return (
        <HeaderContext.Provider value={value}>
            {children}
        </HeaderContext.Provider>
    )
}

/** A placement function over a counted map: each call adds one for `uid`, its undo takes it away. */
const countedPlacement =
    (set: Dispatch<SetStateAction<ReadonlyMap<string, number>>>) =>
    (uid: string) => {
        const bump = (by: number) =>
            set((current) => {
                const next = new Map(current)
                const count = (next.get(uid) ?? 0) + by
                if (count > 0) {
                    next.set(uid, count)
                } else {
                    next.delete(uid)
                }
                return next
            })
        bump(1)
        return () => bump(-1)
    }

/**
 * Loads one tracked entity and the attribute metadata for the banner, once for all
 * the parts inside. It renders only its children.
 */
export function TrackedEntityHeaderProvider(
    props: TrackedEntityHeaderProviderProps
) {
    // Another tracked entity or program starts from nothing, so a part never shows
    // the previous record's values while the new ones load.
    return (
        <HeaderScope
            key={`${props.trackedEntity}:${normaliseProgram(props.program) ?? ''}`}
            {...props}
        />
    )
}
