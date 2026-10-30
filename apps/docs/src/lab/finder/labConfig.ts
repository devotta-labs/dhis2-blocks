/**
 * Everything the finder lab can vary: the program's metadata, how the fake
 * server answers, and how the finder's parts are composed. Presets are whole
 * configs, so picking one and then tweaking it never mixes two scenarios.
 */

export const VALUE_TYPES = [
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'USERNAME',
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'BOOLEAN',
    'TRUE_ONLY',
    'DATE',
    'AGE',
    'DATETIME',
    'IMAGE',
    'FILE_RESOURCE',
    'COORDINATE',
    'ORGANISATION_UNIT',
] as const

export const OPERATORS = ['eq', 'like', 'sw', 'gt', 'ge', 'lt', 'le'] as const
export const TEXT_OPERATORS = ['like', 'sw', 'eq'] as const

export const CALENDARS = [
    'gregorian',
    'iso8601',
    'ethiopian',
    'coptic',
    'nepali',
    'persian',
    'islamic',
    'thai',
] as const

export const DATE_FORMATS = ['YYYY-MM-DD', 'DD-MM-YYYY'] as const

export interface LabOption {
    code: string
    name: string
}

export interface LabAttribute {
    id: string
    label: string
    valueType: string
    unique: boolean
    searchable: boolean
    displayInList: boolean
    options?: LabOption[]
    minCharacters: number
    blocked: string[]
    preferred?: string
}

export interface LabProgram {
    name: string
    minAttributes: number
    /** 0 = no cap. */
    maxResults: number
    attributes: LabAttribute[]
}

export const SEARCH_ANSWERS = [
    ['ok', 'Answer with the matches below'],
    ['conflict', '409 maxTeiCountReached'],
    ['bad-request', '400 (not retried)'],
    ['server-error', '500 (retried twice)'],
    ['never', 'Never answer'],
] as const

export const METADATA_ANSWERS = [
    ['ok', 'Load'],
    ['fails', 'Fail'],
    ['never', 'Never answer'],
] as const

export interface LabServer {
    /** How many people every search matches, across all pages. */
    matches: number
    /** Without a total, the finder pages by whether a page came back full. */
    reportsTotal: boolean
    latency: number
    search: (typeof SEARCH_ANSWERS)[number][0]
    program: (typeof METADATA_ANSWERS)[number][0]
    systemInfo: (typeof METADATA_ANSWERS)[number][0]
    calendar: (typeof CALENDARS)[number]
    dateFormat: (typeof DATE_FORMATS)[number]
}

export interface LabField {
    attribute: string
    range: boolean
    label?: string
    placeholder?: string
    description?: string
}

export const RESULTS_LAYOUTS = [
    ['default', 'Default results'],
    ['custom', 'Composed rows and states'],
    ['hooks', 'Hooks only'],
    ['none', 'No results'],
] as const

export const FORM_LAYOUTS = [
    ['stacked', 'All forms at once'],
    ['swap', 'One at a time, with links'],
] as const

export interface LabComposition {
    forms: LabField[][]
    formLayout: (typeof FORM_LAYOUTS)[number][0]
    /** Fields built from `useFinderField` instead of `FinderField`. */
    hookFields: boolean
    hint: boolean
    results: (typeof RESULTS_LAYOUTS)[number][0]
    /** Composed results only: the attributes each row shows. */
    rowAttributes: string[]
    customTexts: boolean
}

export interface LabConfig {
    program: LabProgram
    server: LabServer
    composition: LabComposition
}

export const SAMPLE_OPTIONS: LabOption[] = [
    { code: 'A', name: 'Option A' },
    { code: 'B', name: 'Option B' },
    { code: 'C', name: 'Option C' },
]
