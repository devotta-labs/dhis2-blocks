import type { Dhis2Calendar } from '@/components/dhis2-value-display'

export interface Option {
    code: string
    name: string
}

/** What a cell holds: its value type and, for an option set, its options. */
export interface Field {
    valueType: string
    options?: ReadonlyArray<Option>
    /** A DHIS2 field mask (TextPattern), checked against the whole value. */
    fieldMask?: string
}

/** How a cell edits: typed, a control, a pop-up editor, or not at all. */
export type CellKind =
    | 'text'
    | 'number'
    | 'date'
    | 'dateTime'
    | 'time'
    | 'boolean'
    | 'trueOnly'
    | 'option'
    | 'popup'
    | 'readOnly'

export type InputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url'

export type DateFormat = 'YYYY-MM-DD' | 'DD-MM-YYYY'

export interface ValueSettings {
    calendar: Dhis2Calendar
    dateFormat: DateFormat
}

/** `message` is translated into the language set when the problem arises. */
export interface ValueProblem {
    code: string
    message: string
}

export type TypedValue =
    | { ok: true; value: string | undefined }
    | { ok: false; problem: ValueProblem }
