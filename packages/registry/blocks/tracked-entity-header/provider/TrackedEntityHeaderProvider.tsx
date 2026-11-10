import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { useConfig } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, {
    useCallback,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import {
    cacheIdOf,
    isForbidden,
    resourceClientOf,
    shouldRetryTrackedEntityHeaderRequest,
    type TrackedEntityHeaderClient,
} from '../api/client'
import { fetchAttributeMetadata, fetchTrackedEntity } from '../api/queries'
import { trackedEntityHeaderQueryKeys } from '../api/queryKeys'
import { useTrackedEntityHeaderClient } from '../api/runtimeClient'
import { displayLocale } from '../format/display'
import {
    HeaderContext,
    type HeaderContextValue,
    type TrackedEntityHeaderState,
} from './context'

export interface TrackedEntityHeaderProviderProps {
    /** The person the banner shows. */
    trackedEntity: string
    /** The program whose attributes, enrollment and owner the banner shows; without one, the person type's. */
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

    const person = useQuery({
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
    // Without a program, the person's type says which attributes there are.
    const type = person.data?.type
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
    })

    const { refetch: refetchPerson } = person
    const { refetch: refetchMetadata } = metadata
    const personFailed = person.isError
    const metadataFailed = metadata.isError
    const retry = useCallback(() => {
        if (personFailed) {
            void refetchPerson()
        }
        if (metadataFailed) {
            void refetchMetadata()
        }
    }, [personFailed, metadataFailed, refetchPerson, refetchMetadata])

    const personError = person.error
    const metadataError = metadata.error
    const personData = person.data
    const metadataData = metadata.data
    const state = useMemo((): TrackedEntityHeaderState => {
        const errors = [personError, metadataError].filter(
            (error): error is Error => error !== null
        )
        // Restricted outranks failed: the person can't be shown however the other request went.
        if (errors.some(isForbidden)) {
            return { status: 'restricted', retry }
        }
        if (errors.length > 0) {
            return { status: 'failed', retry }
        }
        if (!personData || !metadataData) {
            return { status: 'loading', retry }
        }
        return {
            status: 'ready',
            retry,
            trackedEntity: personData,
            metadata: metadataData,
        }
    }, [personError, metadataError, personData, metadataData, retry])

    const logged = useRef(new Set<string>())
    const logProblem = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    const [counts, setCounts] = useState<ReadonlyMap<string, number>>(
        () => new Map()
    )
    const placeAttribute = useCallback((uid: string) => {
        const bump = (by: number) =>
            setCounts((current) => {
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
    }, [])
    const placed = useMemo<ReadonlySet<string>>(
        () => new Set(counts.keys()),
        [counts]
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
        ]
    )

    return (
        <HeaderContext.Provider value={value}>
            {children}
        </HeaderContext.Provider>
    )
}

/**
 * Loads one person and the attribute metadata for the banner, once for all
 * the parts inside. It renders only its children.
 */
export function TrackedEntityHeaderProvider(
    props: TrackedEntityHeaderProviderProps
) {
    // Another person or program starts from nothing, so a part never shows
    // the previous person's values while the new ones load.
    return (
        <HeaderScope
            key={`${props.trackedEntity}:${normaliseProgram(props.program) ?? ''}`}
            {...props}
        />
    )
}
