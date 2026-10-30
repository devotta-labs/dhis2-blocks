import {
    type LabAttribute,
    type LabComposition,
    type LabConfig,
    type LabField,
    type LabOption,
    type LabProgram,
    type LabServer,
} from './labConfig'

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

const SERVER: LabServer = {
    matches: 3,
    reportsTotal: true,
    latency: 300,
    search: 'ok',
    program: 'ok',
    systemInfo: 'ok',
    calendar: 'gregorian',
    dateFormat: 'YYYY-MM-DD',
}

const field = (attributeId: string, range = false): LabField => ({
    attribute: attributeId,
    range,
})

const COMPOSITION: LabComposition = {
    forms: [[field('nationalId'), field('firstName'), field('dob')]],
    formLayout: 'stacked',
    hookFields: false,
    hint: true,
    results: 'default',
    rowAttributes: ['firstName', 'lastName', 'dob'],
    customTexts: false,
}

export const DEFAULT_CONFIG: LabConfig = {
    program: {
        name: 'Lab person register',
        minAttributes: 2,
        maxResults: 50,
        attributes: PERSON_ATTRIBUTES,
    },
    server: SERVER,
    composition: COMPOSITION,
}

type Tweak = (config: LabConfig) => LabConfig

const withServer =
    (server: Partial<LabServer>): Tweak =>
    (config) => ({ ...config, server: { ...config.server, ...server } })

const withProgram =
    (program: Partial<LabProgram>): Tweak =>
    (config) => ({ ...config, program: { ...config.program, ...program } })

const withComposition =
    (composition: Partial<LabComposition>): Tweak =>
    (config) => ({
        ...config,
        composition: { ...config.composition, ...composition },
    })

const tweak = (...tweaks: Tweak[]): LabConfig =>
    tweaks.reduce((config, each) => each(config), DEFAULT_CONFIG)

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

/** Starting points, grouped: pick one, then tweak anything. */
export const PRESETS: { group: string; name: string; config: LabConfig }[] = [
    {
        group: 'Shapes',
        name: 'ID or details',
        config: DEFAULT_CONFIG,
    },
    {
        group: 'Shapes',
        name: 'ID form, then a details form',
        config: tweak(
            withComposition({
                forms: [
                    [field('nationalId')],
                    [field('firstName'), field('lastName'), field('dob')],
                ],
                formLayout: 'swap',
            })
        ),
    },
    {
        group: 'Shapes',
        name: 'Two forms side by side',
        config: tweak(
            withComposition({
                forms: [
                    [field('nationalId')],
                    [field('firstName'), field('sex'), field('dob')],
                ],
            })
        ),
    },
    {
        group: 'Shapes',
        name: 'Every field kind',
        config: tweak(
            withProgram({ attributes: EVERY_KIND, minAttributes: 1 }),
            withComposition({
                forms: [EVERY_KIND.map(({ id }) => field(id))],
                rowAttributes: ['name', 'district', 'dob'],
            })
        ),
    },
    {
        group: 'Shapes',
        name: 'Number and date ranges',
        config: tweak(
            withProgram({ attributes: EVERY_KIND, minAttributes: 1 }),
            withComposition({
                forms: [
                    [
                        field('name'),
                        field('weight', true),
                        field('visits', true),
                        field('dob', true),
                        field('age', true),
                        field('registered', true),
                    ],
                ],
            })
        ),
    },
    {
        group: 'Shapes',
        name: 'Just one ID',
        config: tweak(withComposition({ forms: [[field('nationalId')]] })),
    },
    {
        group: 'Program rules',
        name: 'Needs three details',
        config: tweak(
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
    },
    {
        group: 'Program rules',
        name: 'Minimum characters and blocked operators',
        config: tweak(
            withProgram({
                minAttributes: 1,
                attributes: PERSON_ATTRIBUTES.map((each) => {
                    if (each.id === 'firstName') {
                        return { ...each, minCharacters: 4 }
                    }
                    if (each.id === 'lastName') {
                        return { ...each, blocked: ['like'], preferred: 'sw' }
                    }
                    if (each.id === 'phone') {
                        return { ...each, blocked: ['like', 'sw'] }
                    }
                    return each
                }),
            }),
            withComposition({
                forms: [
                    [field('firstName'), field('lastName'), field('phone')],
                ],
            })
        ),
    },
    {
        group: 'Program rules',
        name: 'Setup mistakes',
        config: tweak(
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
                        field('village'),
                        field('photo'),
                        field('nickname'),
                        field('notAnAttribute'),
                        field('firstName', true),
                        field('dob'),
                        field('dob', true),
                    ],
                ],
            })
        ),
    },
    {
        group: 'Program rules',
        name: 'A form that can never search',
        config: tweak(
            withProgram({ minAttributes: 3 }),
            withComposition({ forms: [[field('firstName'), field('dob')]] })
        ),
    },
    {
        group: 'Server answers',
        name: 'No one found',
        config: tweak(withServer({ matches: 0 })),
    },
    {
        group: 'Server answers',
        name: 'Many pages',
        config: tweak(
            withProgram({ maxResults: 0 }),
            withServer({ matches: 47 })
        ),
    },
    {
        group: 'Server answers',
        name: 'Pages without a total',
        config: tweak(
            withProgram({ maxResults: 0 }),
            withServer({ matches: 30, reportsTotal: false })
        ),
    },
    {
        group: 'Server answers',
        name: 'Over the program cap',
        config: tweak(
            withProgram({ maxResults: 5 }),
            withServer({ matches: 12 })
        ),
    },
    {
        group: 'Server answers',
        name: 'Server says too many (409)',
        config: tweak(withServer({ search: 'conflict' })),
    },
    {
        group: 'Server answers',
        name: 'Search fails',
        config: tweak(withServer({ search: 'server-error', latency: 600 })),
    },
    {
        group: 'Server answers',
        name: 'Slow search',
        config: tweak(withServer({ latency: 4000, matches: 25 })),
    },
    {
        group: 'Server answers',
        name: 'Program fails to load',
        config: tweak(withServer({ program: 'fails' })),
    },
    {
        group: 'Server answers',
        name: 'Program never loads',
        config: tweak(withServer({ program: 'never' })),
    },
    {
        group: 'Dates',
        name: 'Ethiopian calendar',
        config: tweak(
            withServer({ calendar: 'ethiopian' }),
            withComposition({
                forms: [[field('firstName'), field('lastName'), field('dob')]],
            })
        ),
    },
    {
        group: 'Dates',
        name: 'Nepali, DD-MM-YYYY, date range',
        config: tweak(
            withServer({ calendar: 'nepali', dateFormat: 'DD-MM-YYYY' }),
            withComposition({
                forms: [[field('firstName'), field('dob', true)]],
            })
        ),
    },
    {
        group: 'Composition',
        name: 'Composed rows and own texts',
        config: tweak(
            withServer({ matches: 14 }),
            withProgram({ maxResults: 0 }),
            withComposition({ results: 'custom', customTexts: true })
        ),
    },
    {
        group: 'Composition',
        name: 'Built from hooks only',
        config: tweak(
            withServer({ matches: 14 }),
            withProgram({ maxResults: 0 }),
            withComposition({ results: 'hooks', hookFields: true })
        ),
    },
    {
        group: 'Composition',
        name: 'Own labels and help text',
        config: tweak(
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
    },
    {
        group: 'Composition',
        name: 'No hint',
        config: tweak(withComposition({ hint: false })),
    },
    {
        group: 'Stress',
        name: 'Long labels',
        config: tweak(
            withProgram({ attributes: LONG_LABELS }),
            withComposition({
                forms: [LONG_LABELS.map(({ id }) => field(id))],
                rowAttributes: ['firstName', 'dob'],
            })
        ),
    },
    {
        group: 'Stress',
        name: 'Arabic labels (try right to left)',
        config: tweak(
            withProgram({ attributes: ARABIC }),
            withComposition({
                forms: [ARABIC.map(({ id }) => field(id))],
                rowAttributes: ['firstName', 'lastName', 'dob'],
            })
        ),
    },
    {
        group: 'Stress',
        name: 'Many fields',
        config: tweak(
            withProgram({ attributes: EVERY_KIND, minAttributes: 2 }),
            withComposition({
                forms: [EVERY_KIND.slice(0, 13).map(({ id }) => field(id))],
            })
        ),
    },
]

/** Live programs on the Sierra Leone demo database, as the docs use. */
export const LIVE_PRESETS: {
    name: string
    program: string
    forms: LabField[][]
}[] = [
    {
        name: 'WHO RMNCH Tracker: ID or name and birth date',
        program: 'WSGAb5XwJ3Y',
        forms: [
            [field('lZGmxYbs97q')],
            [field('w75KJ2mc4zz'), field('gHGyrwKPzej')],
        ],
    },
    {
        name: 'TB program: identifier or names',
        program: 'ur1Edk5Oe2n',
        forms: [
            [field('xs8A6tQJY0s')],
            [field('w75KJ2mc4zz'), field('zDhUuAYrxNC')],
        ],
    },
    {
        name: 'Child Programme',
        program: 'IpHINAT79UW',
        forms: [[field('w75KJ2mc4zz'), field('zDhUuAYrxNC')]],
    },
]
