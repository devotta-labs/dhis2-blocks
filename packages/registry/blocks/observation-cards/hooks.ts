import { useEffect, useMemo } from 'react'
import { buildSeries } from './api/buildSeries'
import type { ObservationSeries, ProgramMetadata } from './api/types'
import { useObservationsContext } from './provider/context'
import { isProduction } from './provider/env'

export type ObservationState =
    | { status: 'pending' }
    | { status: 'error'; error: Error }
    | { status: 'misconfigured'; message: string }
    | { status: 'ready'; series: ObservationSeries }

const describeMisconfigured = (
    dataElement: string,
    program: string,
    metadata: ProgramMetadata
) => {
    const captured = [...metadata.dataElements.values()]
        .map(({ id, displayName }) => `${id} (${displayName})`)
        .join(', ')
    return `Data element ${dataElement} is not captured by any stage of program ${program}. Captured data elements: ${captured || 'none'}`
}

/**
 * One data element's observations for the provider's person and program.
 * A data element no stage of the program captures is `misconfigured`, never
 * an empty series.
 */
export const useObservation = (dataElement: string): ObservationState => {
    const { program, metadata, events, error, logProblem } =
        useObservationsContext()

    const state = useMemo((): ObservationState => {
        // A wrong id is wrong for every person, so it outranks their errors.
        const element = metadata?.dataElements.get(dataElement)
        const invalid = metadata?.invalidDataElements.get(dataElement)
        // Captured, but its metadata can't be read: only this card fails.
        if (invalid && !element) {
            return { status: 'error', error: invalid.error }
        }
        if (metadata && !element) {
            return {
                status: 'misconfigured',
                message: describeMisconfigured(dataElement, program, metadata),
            }
        }
        if (error) {
            return { status: 'error', error }
        }
        if (!metadata || !element || !events) {
            return { status: 'pending' }
        }
        return {
            status: 'ready',
            series: buildSeries({
                dataElement: element,
                stages: metadata.stages,
                events,
            }),
        }
    }, [dataElement, program, metadata, events, error])

    const problem = state.status === 'misconfigured' ? state.message : undefined
    useEffect(() => {
        // Development shows the full message on the card; production logs it.
        if (problem !== undefined && isProduction()) {
            logProblem(problem)
        }
    }, [problem, logProblem])

    return state
}
