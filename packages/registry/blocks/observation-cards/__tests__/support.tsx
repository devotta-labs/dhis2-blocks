import { Provider } from '@dhis2/app-runtime'
import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import type {
    DataElementMetadata,
    ObservationLegendBand,
    ObservationOption,
    ProgramMetadata,
    StageMetadata,
    TrackerEventRecord,
} from '../api/types'
import {
    ObservationsContext,
    type ObservationsContextValue,
} from '../provider/context'

/** The data element every test card asks for. */
export const DE = 'hbDE0000001'
export const PROGRAM = 'prog1'

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

export type FakeStatus = 'ready' | 'pending' | 'error' | 'misconfigured'

const DEFAULT_STAGE = 'Antenatal visit'
const stageId = (name: string) => `stage-${name}`

const metadataFor = (observation: FakeObservation): ProgramMetadata => {
    const {
        label = 'Haemoglobin',
        valueType = 'NUMBER',
        readings = [],
        legends,
        options,
        partial = false,
    } = observation
    const names = new Set([
        DEFAULT_STAGE,
        ...readings.map(({ stage = DEFAULT_STAGE }) => stage),
    ])
    const stages: StageMetadata[] = [...names].map((name) => ({
        id: stageId(name),
        displayName: name,
        canReadData: true,
        dataElementIds: [DE],
    }))
    if (partial) {
        stages.push({
            id: 'stage-hidden',
            displayName: 'Hidden visit',
            canReadData: false,
            dataElementIds: [DE],
        })
    }
    const element: DataElementMetadata = {
        id: DE,
        displayName: label,
        valueType,
        legendSets: legends ? [{ legends }] : undefined,
        optionSet: options
            ? {
                  options: options.map(({ code, name, color }) => ({
                      code,
                      name,
                      style: color ? { color } : undefined,
                  })),
              }
            : undefined,
    }
    return { stages, dataElements: new Map([[DE, element]]) }
}

const eventsFor = ({ readings = [] }: FakeObservation): TrackerEventRecord[] =>
    readings.map(({ value, day, stage = DEFAULT_STAGE }, index) => ({
        event: `ev${String(index).padStart(3, '0')}`,
        programStage: stageId(stage),
        status: 'COMPLETED',
        occurredAt: `${day}T00:00:00.000`,
        dataValues: [{ dataElement: DE, value }],
    }))

const contextFor = (
    observation: FakeObservation,
    status: FakeStatus
): ObservationsContextValue => {
    const base = { program: PROGRAM, logProblem: () => {} }
    switch (status) {
        case 'pending':
            return base
        case 'error':
            return { ...base, error: new Error('boom') }
        case 'misconfigured':
            return {
                ...base,
                metadata: { stages: [], dataElements: new Map() },
                events: [],
            }
        default:
            return {
                ...base,
                metadata: metadataFor(observation),
                events: eventsFor(observation),
            }
    }
}

/**
 * Feeds the provider's context directly, so a card sees the data a real
 * provider would have loaded, with no requests.
 */
function FakeObservations({
    observation = {},
    status = 'ready',
    children,
}: {
    observation?: FakeObservation
    status?: FakeStatus
    children: ReactNode
}) {
    return (
        <ObservationsContext.Provider value={contextFor(observation, status)}>
            {children}
        </ObservationsContext.Provider>
    )
}

/** app-runtime's own provider, so cards read the system calendar as in an app. */
function Runtime({
    calendar,
    children,
}: {
    calendar: string
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
            {children}
        </Provider>
    )
}

export const renderWith = (
    ui: ReactNode,
    observation: FakeObservation = {},
    status: FakeStatus = 'ready',
    calendar = 'gregorian'
) =>
    render(
        <Runtime calendar={calendar}>
            <FakeObservations observation={observation} status={status}>
                {ui}
            </FakeObservations>
        </Runtime>
    )

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
