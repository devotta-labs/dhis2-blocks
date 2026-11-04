import type { LabNetwork } from '../network'
import type {
    LabAttribute,
    LabComposition,
    LabField,
    LabOption,
    LabProgram,
    LabServer,
    LabSettings,
} from './labData'

const attribute = (
    id: string,
    label: string,
    valueType: string,
    overrides: Partial<LabAttribute> = {}
): LabAttribute => ({
    id,
    label,
    valueType,
    unique: false,
    searchable: true,
    displayInList: false,
    minCharacters: 0,
    blocked: [],
    ...overrides,
})

const SEX_OPTIONS: LabOption[] = [
    { code: 'F', name: 'Female' },
    { code: 'M', name: 'Male' },
]

const ALLERGIES = attribute('allergies', 'Allergies', 'MULTI_TEXT', {
    options: [
        { code: 'PEN', name: 'Penicillin' },
        { code: 'SULFA', name: 'Sulfa drugs' },
        { code: 'NSAID', name: 'NSAIDs' },
        { code: 'LATEX', name: 'Latex' },
    ],
})

const PERSON_ATTRIBUTES: LabAttribute[] = [
    attribute('nationalId', 'National ID', 'TEXT', {
        unique: true,
        displayInList: true,
    }),
    attribute('firstName', 'First name', 'TEXT', {
        displayInList: true,
        minCharacters: 2,
    }),
    attribute('lastName', 'Last name', 'TEXT', { displayInList: true }),
    attribute('dob', 'Date of birth', 'DATE', { displayInList: true }),
    attribute('sex', 'Sex', 'TEXT', {
        displayInList: true,
        options: SEX_OPTIONS,
    }),
    attribute('phone', 'Phone number', 'PHONE_NUMBER'),
    attribute('village', 'Village', 'TEXT', { searchable: false }),
]

const SERVER: LabServer = { matches: 3, calendar: 'gregorian' }

const NETWORK: LabNetwork = { delay: 300, endpoints: {} }

const field = (attributeId: string, range = false): LabField => ({
    attribute: attributeId,
    range,
})

const COMPOSITION: LabComposition = {
    forms: [[field('nationalId'), field('firstName'), field('dob')]],
    formLayout: 'stacked',
    build: 'parts',
    rowAttributes: ['firstName', 'lastName', 'dob'],
}

export const DEFAULT_SETTINGS: LabSettings = {
    program: {
        name: 'Person register',
        minAttributes: 2,
        maxResults: 50,
        attributes: PERSON_ATTRIBUTES,
    },
    server: SERVER,
    composition: COMPOSITION,
    network: NETWORK,
    rtl: false,
}

type Tweak = (settings: LabSettings) => LabSettings

/** One endpoint failing with a 500 or never answering. */
const withEndpoint =
    (resource: string, behaviour: 'fails' | 'hangs'): Tweak =>
    (settings) => ({
        ...settings,
        network: {
            ...settings.network,
            endpoints: { [resource]: { behaviour } },
        },
    })

const withServer =
    (server: Partial<LabServer>): Tweak =>
    (settings) => ({ ...settings, server: { ...settings.server, ...server } })

const withProgram =
    (program: Partial<LabProgram>): Tweak =>
    (settings) => ({
        ...settings,
        program: { ...settings.program, ...program },
    })

const withComposition =
    (composition: Partial<LabComposition>): Tweak =>
    (settings) => ({
        ...settings,
        composition: { ...settings.composition, ...composition },
    })

const tweak = (...tweaks: Tweak[]): LabSettings =>
    tweaks.reduce((settings, each) => each(settings), DEFAULT_SETTINGS)

const EVERY_KIND: LabAttribute[] = [
    attribute('caseId', 'Case ID', 'TEXT', {
        unique: true,
        displayInList: true,
    }),
    attribute('name', 'Name', 'TEXT', { displayInList: true }),
    attribute('notes', 'Notes', 'LONG_TEXT'),
    attribute('email', 'Email', 'EMAIL'),
    attribute('district', 'District', 'TEXT', {
        displayInList: true,
        options: [
            { code: 'BO', name: 'Bo' },
            { code: 'KE', name: 'Kenema' },
            { code: 'PL', name: 'Port Loko' },
        ],
    }),
    { ...ALLERGIES, displayInList: true },
    attribute('pregnant', 'Pregnant', 'BOOLEAN', { displayInList: true }),
    attribute('consent', 'Consent given', 'TRUE_ONLY'),
    attribute('weight', 'Weight (kg)', 'NUMBER', { displayInList: true }),
    attribute('visits', 'Visits', 'INTEGER_ZERO_OR_POSITIVE'),
    attribute('coverage', 'Coverage', 'PERCENTAGE'),
    attribute('dob', 'Date of birth', 'DATE', { displayInList: true }),
    attribute('age', 'Age', 'AGE'),
    attribute('registered', 'Registered at', 'DATETIME', {
        displayInList: true,
    }),
    attribute('photo', 'Photo', 'IMAGE'),
    attribute('location', 'Location', 'COORDINATE'),
]

const ARABIC: LabAttribute[] = [
    attribute('nationalId', 'الرقم الوطني', 'TEXT', {
        unique: true,
        displayInList: true,
    }),
    attribute('firstName', 'الاسم الأول', 'TEXT', { displayInList: true }),
    attribute('lastName', 'اسم العائلة', 'TEXT', { displayInList: true }),
    attribute('dob', 'تاريخ الميلاد', 'DATE', { displayInList: true }),
]

const LONG_LABELS: LabAttribute[] = [
    attribute(
        'nationalId',
        'National identification number issued by the civil registration and vital statistics office',
        'TEXT',
        { unique: true, displayInList: true }
    ),
    attribute(
        'firstName',
        "Mother's given name as written on the antenatal care card",
        'TEXT',
        { displayInList: true }
    ),
    attribute(
        'dob',
        'Date of birth (estimated if the exact date is not known to the client)',
        'DATE',
        { displayInList: true }
    ),
]

export interface Preset {
    group: string
    name: string
    settings: LabSettings
}

const preset = (group: string, name: string, ...tweaks: Tweak[]): Preset => ({
    group,
    name,
    settings: tweak(...tweaks),
})

const RANGES: LabField[] = [
    field('name'),
    field('weight', true),
    field('visits', true),
    field('dob', true),
    field('registered', true),
]

// Names say what the canvas shows. Calendar and the number of people found are
// options, so no preset only changes one.
export const PRESETS: readonly Preset[] = [
    // First, so the lab opens on it: one form, an ID or a name and birth date.
    preset('Searches', 'ID, or name and birth date'),
    preset(
        'Searches',
        'ID first, then other details',
        withComposition({
            forms: [
                [field('nationalId')],
                [field('firstName'), field('lastName'), field('dob')],
            ],
            formLayout: 'swap',
        })
    ),
    preset(
        'Searches',
        'Number and date ranges',
        withProgram({ attributes: EVERY_KIND, minAttributes: 1 }),
        withComposition({ forms: [RANGES], rowAttributes: ['name', 'dob'] })
    ),
    preset(
        'Searches',
        'Every kind of field',
        withProgram({ attributes: EVERY_KIND, minAttributes: 1 }),
        withComposition({
            forms: [EVERY_KIND.map(({ id }) => field(id))],
            rowAttributes: ['name', 'district', 'dob'],
        })
    ),
    preset(
        'Searches',
        'Pick several options',
        withProgram({
            attributes: [
                ...PERSON_ATTRIBUTES,
                { ...ALLERGIES, displayInList: true },
            ],
        }),
        withComposition({
            forms: [
                [field('firstName'), field('lastName'), field('allergies')],
            ],
        })
    ),
    preset(
        'Program rules',
        'Needs three details',
        withProgram({ minAttributes: 3 }),
        withComposition({
            forms: [
                [
                    field('firstName'),
                    field('lastName'),
                    field('dob'),
                    field('sex'),
                    field('phone'),
                ],
            ],
        })
    ),
    preset(
        'Program rules',
        'Name needs four characters',
        withProgram({
            minAttributes: 1,
            attributes: PERSON_ATTRIBUTES.map((each) =>
                each.id === 'firstName' ? { ...each, minCharacters: 4 } : each
            ),
        }),
        withComposition({
            forms: [[field('firstName'), field('lastName'), field('phone')]],
        })
    ),
    preset(
        'Program rules',
        "Fields that don't fit the program",
        withProgram({
            attributes: [
                ...PERSON_ATTRIBUTES,
                attribute('photo', 'Photo', 'IMAGE'),
                attribute('nickname', 'Nickname', 'TEXT', {
                    blocked: ['like', 'sw', 'eq'],
                }),
            ],
        }),
        withComposition({
            forms: [
                [
                    field('firstName'),
                    field('lastName'),
                    field('village'),
                    field('photo'),
                    field('nickname'),
                    field('notAnAttribute'),
                    field('dob'),
                    field('dob', true),
                ],
            ],
        })
    ),
    preset('Results', 'No one found', withServer({ matches: 0 })),
    preset(
        'Results',
        'Many pages',
        withProgram({ maxResults: 0 }),
        withServer({ matches: 47 })
    ),
    preset(
        'Results',
        'Too many matches',
        withProgram({ maxResults: 5 }),
        withServer({ matches: 12 })
    ),
    preset(
        'Results',
        'Search fails',
        withEndpoint('tracker/trackedEntities', 'fails')
    ),
    preset(
        'Results',
        'Program fails to load',
        withEndpoint('programs', 'fails')
    ),
    preset(
        'Your own code',
        'Own labels and help text',
        withComposition({
            forms: [
                [
                    {
                        attribute: 'nationalId',
                        range: false,
                        label: 'ID card number',
                        placeholder: 'e.g. SL-0042-17',
                        description: 'The number on the front of the card.',
                    },
                    {
                        attribute: 'firstName',
                        range: false,
                        placeholder: 'At least 2 letters',
                    },
                    field('dob'),
                ],
            ],
        })
    ),
    preset(
        'Your own code',
        'Own result rows and messages',
        withServer({ matches: 14 }),
        withProgram({ maxResults: 0 }),
        withComposition({ build: 'own-rows' })
    ),
    preset(
        'Your own code',
        'Fields and results from hooks',
        withServer({ matches: 14 }),
        withProgram({ maxResults: 0 }),
        withComposition({ build: 'hooks' })
    ),
    preset(
        'Text',
        'Long labels',
        withProgram({ attributes: LONG_LABELS }),
        withComposition({
            forms: [LONG_LABELS.map(({ id }) => field(id))],
            rowAttributes: ['firstName', 'dob'],
        })
    ),
    preset(
        'Text',
        'Arabic, right to left',
        withProgram({ attributes: ARABIC }),
        withComposition({
            forms: [ARABIC.map(({ id }) => field(id))],
            rowAttributes: ['firstName', 'lastName', 'dob'],
        }),
        (settings) => ({ ...settings, rtl: true })
    ),
]
