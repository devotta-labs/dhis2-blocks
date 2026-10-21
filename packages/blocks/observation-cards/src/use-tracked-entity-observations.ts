import { useDataEngine } from '@dhis2/app-runtime'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import { buildSeries } from './hooks/buildSeries'
import { createObservationsClient } from './hooks/client'
import {
    fetchDataElements,
    fetchEnrollment,
    fetchEvents,
    fetchStages,
} from './hooks/queries'
import { observationQueryKeys } from './hooks/queryKeys'
import type { ObservationSeries } from './hooks/types'

/** Parses a DHIS2 date or date-time to epoch milliseconds, as the hook orders them. */
export { toInstant } from './hooks/buildSeries'

/** Whether a DHIS2 value type is numeric, so its readings carry a `numericValue`. */
export { isNumericValueType } from './hooks/buildSeries'

export type {
    ObservationLegend,
    ObservationOption,
    ObservationPoint,
    ObservationSeries,
} from './hooks/types'

export type ObservationResult =
    | { status: 'pending' }
    | { status: 'error'; error: Error }
    | { status: 'success'; series: ObservationSeries }

export interface TrackedEntityObservations {
    status: 'pending' | 'error' | 'success'
    error?: Error
    /** Always defined; while loading or on failure it carries that status. */
    get(dataElementId: string): ObservationResult
}

export interface UseTrackedEntityObservationsOptions {
    trackedEntityId: string
    programId: string
    dataElementIds: ReadonlyArray<string>
}

/** Unwraps a Result so React Query owns the error state. */
const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

export const useTrackedEntityObservations = ({
    trackedEntityId,
    programId,
    dataElementIds,
}: UseTrackedEntityObservationsOptions): TrackedEntityObservations => {
    const engine = useDataEngine()
    const client = useMemo(() => createObservationsClient(engine), [engine])

    const teId = trackedEntityId.trim()
    const progId = programId.trim()
    // Nothing to ask for yet: every query waits, so the result stays pending.
    const enabled = teId !== '' && progId !== ''
    const subject = { trackedEntityId: teId, programId: progId }

    // Sorted and deduped so the order of ids never triggers a refetch.
    const idsKey = [...new Set(dataElementIds)].sort().join(',')
    const sortedIds = useMemo(
        () => (idsKey === '' ? [] : idsKey.split(',')),
        [idsKey]
    )

    // Its own observer, not part of useQueries: useQueries gives a changed key
    // a fresh observer, which has no previous data to keep.
    const dataElements = useQuery({
        queryKey: observationQueryKeys.dataElements(sortedIds),
        queryFn: async ({ signal }) =>
            unwrap(await fetchDataElements(client, sortedIds, signal)),
        enabled,
        // A changed id list keeps the loaded cards on screen; only the cards
        // for new ids wait for the refetch.
        placeholderData: keepPreviousData,
    })
    const [stages, events, enrollment] = useQueries({
        queries: [
            {
                queryKey: observationQueryKeys.stages(progId),
                queryFn: async ({ signal }) =>
                    unwrap(await fetchStages(client, progId, signal)),
                enabled,
            },
            {
                queryKey: observationQueryKeys.events(teId, progId),
                queryFn: async ({ signal }) =>
                    unwrap(await fetchEvents(client, subject, signal)),
                enabled,
            },
            {
                // No visible enrollment means no access, never "nothing recorded".
                queryKey: observationQueryKeys.enrollments(teId, progId),
                queryFn: async ({ signal }) =>
                    unwrap(await fetchEnrollment(client, subject, signal)),
                enabled,
            },
        ],
    })

    const queries = [stages, dataElements, events, enrollment]
    const failure = queries.find((query) => query.status === 'error')
    const status: TrackedEntityObservations['status'] =
        failure !== undefined
            ? 'error'
            : queries.some((query) => query.isPending) ||
                dataElements.isPlaceholderData
              ? 'pending'
              : 'success'
    const error = failure?.error ?? undefined

    const stageData = stages.data
    const dataElementData = dataElements.data
    const eventData = events.data

    const seriesById = useMemo(() => {
        const byId = new Map<string, ObservationSeries>()
        if (
            stageData === undefined ||
            dataElementData === undefined ||
            eventData === undefined
        ) {
            return byId
        }
        for (const dataElement of dataElementData) {
            if (sortedIds.includes(dataElement.id)) {
                byId.set(
                    dataElement.id,
                    buildSeries({
                        dataElement,
                        stages: stageData,
                        events: eventData,
                    })
                )
            }
        }
        return byId
    }, [stageData, dataElementData, eventData, sortedIds])

    return useMemo<TrackedEntityObservations>(() => {
        const get = (dataElementId: string): ObservationResult => {
            if (error !== undefined) {
                return { status: 'error', error }
            }
            const series = seriesById.get(dataElementId)
            if (series !== undefined) {
                return { status: 'success', series }
            }
            return status === 'pending'
                ? { status: 'pending' }
                : {
                      status: 'error',
                      error: new Error(
                          `No observations were loaded for data element ${dataElementId}`
                      ),
                  }
        }
        const observations: TrackedEntityObservations = { status, get }
        if (error !== undefined) {
            observations.error = error
        }
        return observations
    }, [status, error, seriesById])
}
