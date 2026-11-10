import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { DateFormat, Field, Option } from '@/components/dhis2-value-types'
import type { LabNetwork } from '../network'

export interface LabSettings {
    required: boolean
    readOnly: boolean
    /** A message of this tone under every field, or none. */
    messages: 'none' | 'error' | 'warning'
    /** Hides one option of each option set. */
    hideOption: boolean
    density: 'regular' | 'compact'
    /** Right to left, as an Arabic or Urdu interface is. */
    rtl: boolean
    calendar: Dhis2Calendar
    dateFormat: DateFormat
    /** Opens with a valid stored value in every field, or with none. */
    filled: boolean
    network: LabNetwork
}

export interface LabField {
    id: string
    label: string
    field: Field
}

/** One field of a value type, labelled with it so a tester knows which type it is. */
const typed = (valueType: string, name: string): LabField => ({
    id: valueType,
    label: `${name} (${valueType})`,
    field: { valueType },
})

const optionSet = (
    id: string,
    valueType: string,
    name: string,
    options: Option[]
): LabField => ({
    id,
    label: `${name} (${valueType}, ${options.length} options)`,
    field: { valueType, options },
})

const options = (names: Record<string, string>): Option[] =>
    Object.entries(names).map(([code, name]) => ({ code, name }))

/** Every DHIS2 value type, and an option set of each size, grouped by how they edit. */
export const GROUPS: ReadonlyArray<{
    legend: string
    fields: readonly LabField[]
}> = [
    {
        legend: 'Text and numbers',
        fields: [
            typed('TEXT', 'Full name'),
            typed('LETTER', 'Initial'),
            typed('PHONE_NUMBER', 'Phone'),
            typed('EMAIL', 'Email'),
            typed('URL', 'Website'),
            typed('NUMBER', 'Weight'),
            typed('UNIT_INTERVAL', 'Adherence'),
            typed('PERCENTAGE', 'Coverage'),
            typed('INTEGER', 'Weight change'),
            typed('INTEGER_POSITIVE', 'Doses given'),
            typed('INTEGER_NEGATIVE', 'Days early'),
            typed('INTEGER_ZERO_OR_POSITIVE', 'Previous pregnancies'),
        ],
    },
    {
        legend: 'Dates and times',
        fields: [
            typed('DATE', 'Visit date'),
            typed('DATETIME', 'Admitted at'),
            typed('TIME', 'Arrival time'),
        ],
    },
    {
        legend: 'Choices',
        fields: [
            typed('BOOLEAN', 'Pregnant'),
            typed('TRUE_ONLY', 'Consent given'),
        ],
    },
    {
        legend: 'Option sets',
        fields: [
            optionSet('shortOptions', 'TEXT', 'Test result', [
                { code: 'POS', name: 'Positive' },
                { code: 'NEG', name: 'Negative' },
                {
                    code: 'INV',
                    name: 'Invalid',
                    description: 'No control line: repeat the test.',
                },
            ]),
            optionSet(
                'longOptions',
                'TEXT',
                'Occupation',
                options({
                    FARM: 'Farmer',
                    TEACH: 'Teacher',
                    TRADE: 'Trader',
                    HEALTH: 'Health worker',
                    STUDENT: 'Student',
                    MINER: 'Miner',
                    FISHER: 'Fisher',
                    OTHER: 'Other',
                })
            ),
            optionSet(
                'shortMultiText',
                'MULTI_TEXT',
                'Symptoms',
                options({
                    FEVER: 'Fever',
                    COUGH: 'Cough',
                    RASH: 'Rash',
                    DIARR: 'Diarrhoea',
                })
            ),
            optionSet(
                'longMultiText',
                'MULTI_TEXT',
                'Danger signs',
                options({
                    CONV: 'Convulsions',
                    LETH: 'Lethargy',
                    VOMIT: 'Vomiting everything',
                    DRINK: 'Unable to drink',
                    BREATH: 'Difficult breathing',
                    BLEED: 'Abnormal bleeding',
                    JAUND: 'Jaundice',
                })
            ),
        ],
    },
    {
        legend: 'Inline editors',
        fields: [
            typed('LONG_TEXT', 'Notes'),
            typed('AGE', 'Age'),
            typed('COORDINATE', 'Home location'),
        ],
    },
    {
        legend: 'Server-backed',
        fields: [
            typed('ORGANISATION_UNIT', 'Referred to'),
            typed('USERNAME', 'Assigned to'),
            typed('FILE_RESOURCE', 'Referral letter'),
            typed('IMAGE', 'Wound photo'),
        ],
    },
    {
        legend: 'Read-only',
        fields: [
            typed('GEOJSON', 'Catchment area'),
            typed('REFERENCE', 'Linked record'),
        ],
    },
]

/** One option of each option set, for "Hide an option". */
export const HIDDEN_OPTIONS = ['NEG', 'MINER', 'RASH', 'JAUND']

export const READ_ONLY_REASON = 'Locked by a program rule'

/** What the server searches, as DHIS2 sends it: Sierra Leone's org units, top of the hierarchy first. */
export const ORG_UNITS = [
    ['DiszpKrYNg8', 'Ngelehun CHC', 'Bo', 'Badjia'],
    ['labOrgUnt01', 'Njandama MCHP', 'Bo', 'Badjia'],
    ['labOrgUnt02', 'Bo Government Hospital', 'Bo', 'Kakua'],
    ['labOrgUnt03', 'Bumpe CHC', 'Bo', 'Bumpe Ngao'],
    ['labOrgUnt04', 'Kenema Government Hospital', 'Kenema', 'Nongowa'],
    ['labOrgUnt05', 'Connaught Hospital', 'Western Area', 'Freetown'],
].map(([id = '', displayName = '', ...ancestors]) => ({
    id,
    displayName,
    ancestors: ['Sierra Leone', ...ancestors].map((name) => ({
        displayName: name,
    })),
}))

export const USERS = [
    { username: 'admin', displayName: 'John Traore' },
    { username: 'fatmata.kamara', displayName: 'Fatmata Kamara' },
    { username: 'ibrahim.sesay', displayName: 'Ibrahim Sesay' },
    { username: 'mariama.bangura', displayName: 'Mariama Bangura' },
]

// A file the docs serve, so "Download" and an image's preview (`?dimension=MEDIUM`) load.
const SYMBOL = `${import.meta.env.BASE_URL}dhis2-symbol.svg`

/** The stored files' links, by file resource id. */
export const STORED_FILES = {
    labFile0001: SYMBOL,
    labImage001: SYMBOL,
} satisfies Record<string, string>

/** The names a host knows for stored ids: org units, users and files. */
export const NAMES = {
    ...Object.fromEntries(
        ORG_UNITS.map(({ id, displayName }) => [id, displayName])
    ),
    ...Object.fromEntries(
        USERS.map(({ username, displayName }) => [username, displayName])
    ),
    labFile0001: 'dhis2-symbol.svg',
    labImage001: 'dhis2-symbol.svg',
}

/** A valid stored value for every field, as DHIS2 stores it (ISO dates on any calendar). */
export const FILLED = {
    TEXT: 'Fatmata Kamara',
    LETTER: 'K',
    PHONE_NUMBER: '+23276123456',
    EMAIL: 'fatmata.kamara@example.org',
    URL: 'https://dhis2.org',
    NUMBER: '62.5',
    UNIT_INTERVAL: '0.85',
    PERCENTAGE: '45',
    INTEGER: '-3',
    INTEGER_POSITIVE: '3',
    INTEGER_NEGATIVE: '-14',
    INTEGER_ZERO_OR_POSITIVE: '0',
    DATE: '2026-03-14',
    DATETIME: '2026-03-14T09:30',
    TIME: '09:30',
    BOOLEAN: 'false',
    TRUE_ONLY: 'true',
    shortOptions: 'INV',
    longOptions: 'TEACH',
    shortMultiText: 'FEVER,COUGH',
    longMultiText: 'CONV,LETH',
    LONG_TEXT: 'Seen with her mother.\nReferred for a scan.',
    AGE: '1994-07-02',
    COORDINATE: '[-11.7341,8.0186]',
    ORGANISATION_UNIT: 'DiszpKrYNg8',
    USERNAME: 'admin',
    FILE_RESOURCE: 'labFile0001',
    IMAGE: 'labImage001',
    GEOJSON: '{"type":"Point","coordinates":[-11.7341,8.0186]}',
    REFERENCE: 'Hj2BlQkVeyZ',
} satisfies Record<string, string>

/** Each field's label, by id, for the callback log. */
export const LABELS = new Map(
    GROUPS.flatMap(({ fields }) => fields).map(({ id, label }) => [id, label])
)
