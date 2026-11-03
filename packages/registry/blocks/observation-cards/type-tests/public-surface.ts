import type {
    DataEngineLike,
    ObservationCardProps,
    ObservationChangeProps,
    ObservationLabelProps,
    ObservationLegendProps,
    ObservationPoint,
    ObservationRecordedProps,
    ObservationSeries,
    ObservationSparklineProps,
    ObservationState,
    ObservationsClient,
    ObservationsProviderProps,
    ObservationValueProps,
} from '..'
import {
    ObservationCard,
    ObservationChange,
    ObservationLabel,
    ObservationLegend,
    ObservationRecorded,
    ObservationSparkline,
    ObservationValue,
    ObservationsProvider,
    createObservationsClient,
    useObservation,
} from '..'
import * as publicApi from '..'

export type SupportedObservationTypes = [
    DataEngineLike,
    ObservationCardProps,
    ObservationChangeProps,
    ObservationLabelProps,
    ObservationLegendProps,
    ObservationPoint,
    ObservationRecordedProps,
    ObservationSeries,
    ObservationSparklineProps,
    ObservationState,
    ObservationsClient,
    ObservationsProviderProps,
    ObservationValueProps,
]

export const supportedObservationExports = [
    ObservationsProvider,
    ObservationCard,
    ObservationLabel,
    ObservationLegend,
    ObservationValue,
    ObservationChange,
    ObservationSparkline,
    ObservationRecorded,
    useObservation,
    createObservationsClient,
] as const

export const card: ObservationCardProps = {
    dataElement: 'vANAXwtLwcT',
    unit: 'g/dL',
    label: 'Haemoglobin',
    staleAfterDays: 180,
}

export const cards: unknown[] = [
    // @ts-expect-error the provider names the person, never a card
    ObservationCard({ dataElement: 'uid', trackedEntity: 'person' }),
    // @ts-expect-error the provider names the program, never a card
    ObservationCard({ dataElement: 'uid', program: 'program' }),
    // @ts-expect-error a card shows one data element
    ObservationCard({ dataElement: ['uid', 'other'] }),
    // @ts-expect-error the recorded date cannot be turned off
    ObservationCard({ dataElement: 'uid', hideRecorded: true }),
    // @ts-expect-error colours come from DHIS2 metadata, never from props
    ObservationCard({ dataElement: 'uid', color: 'red' }),
]

export const parts: unknown[] = [
    ObservationSparkline({ points: 6 }),
    ObservationValue({ unit: 'kg' }),
    ObservationLabel({ id: 'label', className: 'text-lg' }),
    ObservationRecorded({ className: 'mt-2' }),
    // @ts-expect-error the sparkline plots readings, not a custom series
    ObservationSparkline({ data: [1, 2, 3] }),
    // @ts-expect-error the label comes from the card or the data element
    ObservationLabel({ children: 'Weight' }),
]

// What the hook returns is narrowed by status.
export const latestValue = (): string | undefined => {
    const state = useObservation('uid')
    if (state.status === 'ready') {
        return state.series.latest?.value
    }
    // @ts-expect-error only a ready state has a series
    return state.series
}

export const client = createObservationsClient({ query: async () => ({}) })
// @ts-expect-error the client is opaque and has no query method
export const noQuery = client.query

// The internal contexts are not exported.
// @ts-expect-error not part of the public surface
export const noProviderContext = publicApi.ObservationsContext
// @ts-expect-error not part of the public surface
export const noCardContext = publicApi.ObservationCardContext
