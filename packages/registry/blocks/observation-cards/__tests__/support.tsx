import { CustomDataProvider, FetchError, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import type { ObservationLegendBand, ObservationOption } from '../api/types'
import { ObservationsProvider } from '../provider/ObservationsProvider'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** The data element every test card asks for. */
export const DE = 'hbDE0000001'
export const PROGRAM = 'prog1'
const TRACKED_ENTITY = 'te1'

export interface Reading {
    value: string
    /** `YYYY-MM-DD`; the reading is recorded at midnight that day. */
    day: string
    stage?: string
}

export interface FakeObservation {
    label?: string
    valueType?: string
    readings?: Reading[]
    legends?: ObservationLegendBand[]
    options?: ObservationOption[]
    /** Adds a stage capturing the element that the user can't read. */
    partial?: boolean
}

export type FakeStatus =
    | 'ready'
    | 'pending'
    | 'error'
    | 'failed-early'
    | 'misconfigured'

const DEFAULT_STAGE = 'Antenatal visit'
const stageId = (name: string) => `stage-${name}`

/** `programs/<id>` as the server sends it. */
const programResponse = (observation: FakeObservation) => {
    const {
        label = 'Haemoglobin',
        valueType = 'NUMBER',
        readings = [],
        legends,
        options,
        partial = false,
    } = observation
    const base = { id: DE, displayName: label, valueType }
    const withLegends = legends ? { ...base, legendSets: [{ legends }] } : base
    const dataElement = options
        ? {
              ...withLegends,
              optionSet: {
                  options: options.map(({ code, name, color }) =>
                      color ? { code, name, style: { color } } : { code, name }
                  ),
              },
          }
        : withLegends
    const names = new Set([
        DEFAULT_STAGE,
        ...readings.map(({ stage = DEFAULT_STAGE }) => stage),
    ])
    const stage = (id: string, displayName: string, read: boolean) => ({
        id,
        displayName,
        access: { data: { read } },
        programStageDataElements: [{ dataElement }],
    })
    return {
        programStages: [
            ...[...names].map((name) => stage(stageId(name), name, true)),
            ...(partial ? [stage('stage-hidden', 'Hidden visit', false)] : []),
        ],
    }
}

/** `tracker/events` as the server sends it. */
const eventsResponse = ({ readings = [] }: FakeObservation) => ({
    events: readings.map(({ value, day, stage = DEFAULT_STAGE }, index) => ({
        event: `ev${String(index).padStart(3, '0')}`,
        trackedEntity: TRACKED_ENTITY,
        programStage: stageId(stage),
        status: 'COMPLETED',
        occurredAt: `${day}T00:00:00.000`,
        dataValues: [{ dataElement: DE, value }],
    })),
})

const never = () => new Promise<never>(() => {})

/** What the server answers, for each state a card can be in. */
const serverFor = (
    observation: FakeObservation,
    status: FakeStatus
): CustomData => ({
    programs: async () => {
        if (status === 'pending') {
            return never()
        }
        if (status === 'failed-early') {
            // A failed request before the program's metadata loaded: no name to show.
            throw new FetchError({
                type: 'unknown',
                message: 'boom',
                details: { httpStatusCode: 400 },
            })
        }
        return status === 'misconfigured'
            ? { programStages: [] }
            : z.json().parse(programResponse(observation))
    },
    'tracker/enrollments': async () => ({
        enrollments: [{ enrollment: 'enr1' }],
    }),
    'tracker/events': async () => {
        if (status === 'error') {
            // A failed person request after the program's metadata loaded.
            throw new FetchError({
                type: 'unknown',
                message: 'boom',
                details: { httpStatusCode: 400 },
            })
        }
        return eventsResponse(observation)
    },
})

/**
 * app-runtime's own provider, so cards read the system calendar as in an app,
 * with the fake server behind its data engine.
 */
function Runtime({
    calendar,
    data,
    children,
}: {
    calendar: string
    data: CustomData
    children: ReactNode
}) {
    const systemInfo = {
        version: '2.42.0',
        contextPath: '',
        serverTimeZoneId: 'UTC',
        calendar,
    }
    return (
        <Provider
            config={{ baseUrl: '..', apiVersion: 42, systemInfo }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>{children}</CustomDataProvider>
        </Provider>
    )
}

/**
 * Renders cards for one person through the real provider and queries, and
 * resolves once every card has left its loading state (never, for `pending`).
 */
export const renderWith = async (
    ui: ReactNode,
    observation: FakeObservation = {},
    status: FakeStatus = 'ready',
    calendar = 'gregorian'
) => {
    const queryClient = new QueryClient()
    const data = serverFor(observation, status)
    const screen = await render(ui, {
        wrapper: ({ children }) => (
            <Runtime calendar={calendar} data={data}>
                <QueryClientProvider client={queryClient}>
                    <ObservationsProvider
                        trackedEntity={TRACKED_ENTITY}
                        program={PROGRAM}
                    >
                        {children}
                    </ObservationsProvider>
                </QueryClientProvider>
            </Runtime>
        ),
    })
    if (status !== 'pending') {
        await expect
            .poll(() => screen.container.querySelector('[aria-busy="true"]'))
            .toBeNull()
    }
    return screen
}

/** Readings on consecutive days of March 2026, from the 1st. */
export const march = (...values: number[]): Reading[] =>
    values.map((value, index) => ({
        value: String(value),
        day: `2026-03-${String(index + 1).padStart(2, '0')}`,
    }))

export const NORMAL: ObservationLegendBand = {
    name: 'Normal',
    color: '#ffef78',
    startValue: 12,
    endValue: 20,
}
