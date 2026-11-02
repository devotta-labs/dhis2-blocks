export type Dhis2Calendar =
    | 'coptic'
    | 'ethiopian'
    | 'gregorian'
    | 'islamic'
    | 'iso8601'
    | 'nepali'
    | 'persian'
    | 'thai'

export interface ValueMeta {
    valueType: string
    optionSet?: {
        options: ReadonlyArray<{ code: string; displayName: string }>
    }
}

export interface FormatOptions {
    calendar: Dhis2Calendar
    locale?: string
    orgUnitNames?: ReadonlyMap<string, string>
}
