import { CustomDataProvider, FetchError } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { z } from 'zod'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

interface FakeDataElement {
    id: string
    displayName: string
    valueType: string
    legendSets?: Array<{
        legends: Array<{
            name: string
            color?: string
            startValue?: number
            endValue?: number
        }>
    }>
    optionSet?: { options: Array<{ code: string }> }
}

export const WEIGHT = 'weightDE0001'
export const TEMP = 'tempDE00001'
export const HEIGHT = 'heightDE0001'

const programResponse = (extraDataElements: FakeDataElement[]) => ({
    programStages: [
        {
            id: 'stage1',
            displayName: 'Visit',
            access: { data: { read: true } },
            programStageDataElements: [
                { id: WEIGHT, displayName: 'Weight', valueType: 'NUMBER' },
                { id: TEMP, displayName: 'Temperature', valueType: 'NUMBER' },
                { id: HEIGHT, displayName: 'Height', valueType: 'NUMBER' },
                ...extraDataElements,
            ].map((dataElement) => ({ dataElement })),
        },
    ],
})

/** One weight reading per person and program, so each series is recognisable. */
const eventsFor = (trackedEntity: string, weight: string) => ({
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
    extraDataElements?: FakeDataElement[]
    noEnrollment?: boolean
    /** Answers events requests with a 400, which is never retried. */
    eventsFail?: boolean
}

/** The DHIS2 resources the cards ask for, served through app-runtime's data engine. */
export const createFakeServer = (options: FakeServerOptions = {}) => {
    const requests: string[] = []
    let release = () => {}
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    const data: CustomData = {
        programs: async () => {
            requests.push('programs')
            return z
                .json()
                .parse(programResponse(options.extraDataElements ?? []))
        },
        'tracker/enrollments': async (_type, query) => {
            requests.push('tracker/enrollments')
            return {
                enrollments: options.noEnrollment
                    ? []
                    : [{ enrollment: `${query.params?.trackedEntity}-enr` }],
            }
        },
        'tracker/events': async (_type, query) => {
            requests.push('tracker/events')
            const trackedEntity = String(query.params?.trackedEntity)
            const program = String(query.params?.program)
            if (options.eventsFail) {
                throw new FetchError({
                    type: 'unknown',
                    message: 'boom',
                    details: { httpStatusCode: 400 },
                })
            }
            if (
                options.deferEventsFor !== undefined &&
                [trackedEntity, program].includes(options.deferEventsFor)
            ) {
                await held
            }
            return eventsFor(trackedEntity, weightFor(trackedEntity, program))
        },
    }
    const countOf = (resource: string) =>
        requests.filter((requested) => requested === resource).length
    return { data, requests, countOf, release }
}

/** The fake server behind app-runtime's data engine, and a fresh QueryClient; reuse it across rerenders. */
export const createWrapper = (data: CustomData) => {
    const queryClient = new QueryClient()
    return ({ children }: { children: ReactNode }) => (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
}
