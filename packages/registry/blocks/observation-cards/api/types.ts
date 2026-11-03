export interface ObservationLegendBand {
    name: string
    /** Absent when the legend has no colour; it then shows as an outline badge. */
    color?: string
    startValue: number
    endValue: number
}

export interface ObservationOption {
    code: string
    name: string
    color?: string
}

export interface ObservationPoint {
    /** Tracker API value; an unticked TRUE_ONLY box at a capturing stage is 'false', shown as Not ticked. */
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
    legends?: ObservationLegendBand[]
    options?: ObservationOption[]
    /** A stage capturing this element is not data-readable. */
    partial: boolean
}

export interface DataElementMetadata {
    id: string
    displayName: string
    displayFormName?: string
    valueType: string
    legendSets?: { legends: ObservationLegendBand[] }[]
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
    trackedEntity?: string
    programStage: string
    status: string
    occurredAt?: string
    createdAt?: string
    dataValues: { dataElement: string; value: string }[]
}

/** A captured data element whose metadata could not be read. */
export interface InvalidDataElement {
    displayName?: string
    error: Error
}

/** A program's stages and every data element they capture, keyed by id. */
export interface ProgramMetadata {
    stages: StageMetadata[]
    dataElements: Map<string, DataElementMetadata>
    /** Captured elements with unreadable metadata: only their own cards error. */
    invalidDataElements: Map<string, InvalidDataElement>
}
