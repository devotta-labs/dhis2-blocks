import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import {
    createObservationsClient,
    type DataEngineLike,
    type ResourceRequest,
} from '../api/client'
import { type ObservationState, useObservation } from '../hooks'

type EngineResult = Awaited<ReturnType<DataEngineLike['query']>>
type EngineValue = EngineResult[string]

export const WEIGHT = 'weightDE0001'
export const TEMP = 'tempDE00001'
export const HEIGHT = 'heightDE0001'

const programResponse = (
    extraDataElements: EngineValue[] = []
): EngineValue => ({
    programStages: [
        {
            id: 'stage1',
            displayName: 'Visit',
            access: { data: { read: true } },
            programStageDataElements: [
                {
                    dataElement: {
                        id: WEIGHT,
                        displayName: 'Weight',
                        valueType: 'NUMBER',
                    },
                },
                {
                    dataElement: {
                        id: TEMP,
                        displayName: 'Temperature',
                        valueType: 'NUMBER',
                    },
                },
                {
                    dataElement: {
                        id: HEIGHT,
                        displayName: 'Height',
                        valueType: 'NUMBER',
                    },
                },
                ...extraDataElements.map((dataElement) => ({ dataElement })),
            ],
        },
    ],
})

/** One weight reading per person and program, so each series is recognisable. */
const eventsFor = (trackedEntity: string, weight: string): EngineValue => ({
    events: [
        {
            event: `${trackedEntity}-ev1`,
            trackedEntity,
            programStage: 'stage1',
            status: 'COMPLETED',
            occurredAt: '2026-03-01T00:00:00.000',
            dataValues: [{ dataElement: WEIGHT, value: weight }],
        },
    ],
})

const WEIGHTS = new Map([
    ['te1', '70'],
    ['te2', '82'],
])

/** prog2 has its own weights, so a program switch is visible. */
const weightFor = (trackedEntity: string, program: string) =>
    program === 'prog2' ? '64' : (WEIGHTS.get(trackedEntity) ?? '0')

interface FakeServerOptions {
    /** Holds this person's, or this program's, events request open until `release` is called. */
    deferEventsFor?: string
    /** More data elements the program's stage captures, as the server sends them. */
    extraDataElements?: EngineValue[]
    noEnrollment?: boolean
    /** Answers events requests with a 400, which is never retried. */
    eventsFail?: boolean
    /** Every person's weight, as a different server might hold it. */
    weight?: string
}

export const createFakeServer = (options: FakeServerOptions = {}) => {
    const requests: ResourceRequest[] = []
    let release = () => {}
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    const engine: DataEngineLike = {
        query: async (query) => {
            const [[key, request]] = Object.entries(query)
            requests.push(request)
            const trackedEntity = String(request.params?.trackedEntity)
            const program = String(request.params?.program)
            switch (request.resource) {
                case 'programs':
                    return {
                        [key]: programResponse(options.extraDataElements),
                    }
                case 'tracker/enrollments':
                    return {
                        [key]: {
                            enrollments: options.noEnrollment
                                ? []
                                : [{ enrollment: `${trackedEntity}-enr` }],
                        },
                    }
                default:
                    if (options.eventsFail) {
                        throw Object.assign(new Error('boom'), {
                            httpStatusCode: 400,
                        })
                    }
                    if (
                        options.deferEventsFor !== undefined &&
                        [trackedEntity, program].includes(
                            options.deferEventsFor
                        )
                    ) {
                        await held
                    }
                    return {
                        [key]: eventsFor(
                            trackedEntity,
                            options.weight ?? weightFor(trackedEntity, program)
                        ),
                    }
            }
        },
    }
    const countOf = (resource: string) =>
        requests.filter((request) => request.resource === resource).length
    return {
        client: createObservationsClient(engine),
        engine,
        requests,
        countOf,
        release,
    }
}

/** A fresh QueryClient with retries off; reuse it across rerenders. */
export const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

const describeState = (state: ObservationState) => {
    switch (state.status) {
        case 'ready':
            return `ready ${state.series.latest?.value ?? 'none'}`
        case 'error':
            return `error ${state.error.message}`
        case 'misconfigured':
            return `misconfigured ${state.message}`
        default:
            return state.status
    }
}

/** Shows one data element's state and records every state it rendered. */
export const Probe = ({
    id,
    dataElement,
    seen,
}: {
    id: string
    dataElement: string
    seen?: string[]
}) => {
    const description = describeState(useObservation(dataElement))
    seen?.push(description)
    return <output data-testid={id}>{description}</output>
}
