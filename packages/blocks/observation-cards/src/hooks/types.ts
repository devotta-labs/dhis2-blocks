export interface ObservationLegend {
    name: string
    color: string
    startValue: number
    endValue: number
}

export interface ObservationOption {
    code: string
    name: string
    color?: string
}

export interface ObservationPoint {
    /** Tracker API value; TRUE_ONLY gaps are 'false'. */
    value: string
    /** Set for numeric types when the value parses. */
    numericValue?: number
    /** ISO date-time as received. */
    occurredAt: string
    source: {
        eventId: string
        programStageId: string
        programStageName: string
    }
}

export interface ObservationSeries {
    dataElementId: string
    /** displayFormName, else displayName. */
    label: string
    valueType: string
    /** Ascending by occurredAt, then createdAt, then eventId. */
    points: ObservationPoint[]
    latest?: ObservationPoint
    previous?: ObservationPoint
    /** latest.numericValue - previous.numericValue, numeric types only. */
    change?: number
    /** First legend set, sorted by startValue. */
    legends?: ObservationLegend[]
    options?: ObservationOption[]
    /** A stage capturing this element is not data-readable. */
    partial: boolean
}

export interface DataElementMetadata {
    id: string
    displayName: string
    displayFormName?: string
    valueType: string
    legendSets?: { legends: ObservationLegend[] }[]
    optionSet?: {
        options: { code: string; name: string; style?: { color?: string } }[]
    }
}

export interface StageMetadata {
    id: string
    displayName: string
    canReadData: boolean
    dataElementIds: string[]
}

export interface TrackerEventRecord {
    event: string
    programStage: string
    status: string
    occurredAt?: string
    createdAt?: string
    dataValues: { dataElement: string; value: string }[]
}
