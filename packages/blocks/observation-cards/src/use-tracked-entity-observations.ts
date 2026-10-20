import { useDataEngine } from '@dhis2/app-runtime'
import { useQueries } from '@tanstack/react-query'
import { Result } from 'better-result'
import { useMemo } from 'react'
import { buildSeries } from './hooks/buildSeries'
import { createObservationsClient } from './hooks/client'
import { fetchDataElements, fetchEvents, fetchStages } from './hooks/queries'
import { observationQueryKeys } from './hooks/queryKeys'
import type { ObservationSeries } from './hooks/types'

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

    // Sorted and deduped so the order of ids never triggers a refetch.
    const idsKey = [...new Set(dataElementIds)].sort().join(',')
    const sortedIds = useMemo(
        () => (idsKey === '' ? [] : idsKey.split(',')),
        [idsKey]
    )

    const [stages, dataElements, events] = useQueries({
        queries: [
            {
                queryKey: observationQueryKeys.stages(programId),
                queryFn: async ({ signal }) =>
                    unwrap(await fetchStages(client, programId, signal)),
            },
            {
                queryKey: observationQueryKeys.dataElements(sortedIds),
                queryFn: async ({ signal }) =>
                    unwrap(await fetchDataElements(client, sortedIds, signal)),
            },
            {
                queryKey: observationQueryKeys.events(
                    trackedEntityId,
                    programId
                ),
                queryFn: async ({ signal }) =>
                    unwrap(
                        await fetchEvents(
                            client,
                            { trackedEntityId, programId },
                            signal
                        )
                    ),
            },
        ],
    })

    const failure = [stages, dataElements, events].find(
        (query) => query.status === 'error'
    )
    const status: TrackedEntityObservations['status'] =
        failure !== undefined
            ? 'error'
            : stages.isPending || dataElements.isPending || events.isPending
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
            if (status === 'pending') {
                return { status: 'pending' }
            }
            if (error !== undefined) {
                return { status: 'error', error }
            }
            const series = seriesById.get(dataElementId)
            return series === undefined
                ? {
                      status: 'error',
                      error: new Error(
                          `No observations were loaded for data element ${dataElementId}`
                      ),
                  }
                : { status: 'success', series }
        }
        const observations: TrackedEntityObservations = { status, get }
        if (error !== undefined) {
            observations.error = error
        }
        return observations
    }, [status, error, seriesById])
}
