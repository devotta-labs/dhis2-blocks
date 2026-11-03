import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useCallback, useMemo, useRef, type ReactNode } from 'react'
import {
    resourceClientOf,
    shouldRetryObservationsRequest,
    type ObservationsClient,
} from '../api/client'
import {
    fetchEnrollment,
    fetchEvents,
    fetchProgramMetadata,
} from '../api/queries'
import { observationQueryKeys } from '../api/queryKeys'
import { useObservationsClient } from '../api/runtimeClient'
import { ObservationsContext, type ObservationsContextValue } from './context'

export interface ObservationsProviderProps {
    /** The person whose observations the cards show. */
    trackedEntity: string
    /** The program whose stages capture the cards' data elements. */
    program: string
    /** A custom data engine's client; app-runtime's is the default. */
    client?: ObservationsClient
    children?: ReactNode
}

/** Unwraps a Result so React Query owns the error state. */
const unwrap = <T,>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const ObservationsScope = ({
    trackedEntity,
    program,
    client,
    children,
}: ObservationsProviderProps) => {
    const runtimeClient = useObservationsClient()
    const resourceClient = useMemo(
        () => resourceClientOf(client ?? runtimeClient),
        [client, runtimeClient]
    )
    const teId = trackedEntity.trim()
    const progId = program.trim()
    // Nothing to ask for yet: every query waits, so every card stays pending.
    const enabled = teId !== '' && progId !== ''
    const subject = { trackedEntityId: teId, programId: progId }

    const metadata = useQuery({
        queryKey: observationQueryKeys.programMetadata(progId),
        queryFn: async ({ signal }) =>
            unwrap(await fetchProgramMetadata(resourceClient, progId, signal)),
        enabled,
        retry: shouldRetryObservationsRequest,
    })
    // No visible enrollment means no access, never "nothing recorded".
    const enrollment = useQuery({
        queryKey: observationQueryKeys.enrollments(teId, progId),
        queryFn: async ({ signal }) =>
            unwrap(await fetchEnrollment(resourceClient, subject, signal)),
        enabled,
        retry: shouldRetryObservationsRequest,
    })
    const events = useQuery({
        queryKey: observationQueryKeys.events(teId, progId),
        queryFn: async ({ signal }) =>
            unwrap(await fetchEvents(resourceClient, subject, signal)),
        enabled,
        retry: shouldRetryObservationsRequest,
    })

    const logged = useRef(new Set<string>())
    const logProblem = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    const error =
        metadata.error ?? enrollment.error ?? events.error ?? undefined
    const personEvents = enrollment.isSuccess ? events.data : undefined
    const value = useMemo<ObservationsContextValue>(
        () => ({
            program: progId,
            metadata: metadata.data,
            events: personEvents,
            error,
            logProblem,
        }),
        [progId, metadata.data, personEvents, error, logProblem]
    )

    return (
        <ObservationsContext.Provider value={value}>
            {children}
        </ObservationsContext.Provider>
    )
}

/**
 * Loads one person's observations in one program: the program's metadata,
 * the person's enrollment and every event, once for all the cards inside.
 * It renders only its children.
 */
export function ObservationsProvider(props: ObservationsProviderProps) {
    // Another person or program starts from nothing, so a card never shows
    // the previous person's values while the new ones load.
    return (
        <ObservationsScope
            key={`${props.trackedEntity}:${props.program}`}
            {...props}
        />
    )
}
