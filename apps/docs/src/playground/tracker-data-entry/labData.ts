import type {
    EventSourceOptions,
    RegisterLayout,
    RegisterSourceOptions,
} from '@/components/tracker-data-entry'
import type { LabNetwork } from '../network'

/** The program on show: an event program, one person's tracker events, or a paper register. */
export type Example = 'inpatient' | 'person' | 'immunisation'

export interface LabSettings {
    example: Example
    /** The server holds the program's rules; off, it has none and the rule engine never loads. */
    rules: boolean
    /** The import refuses every change to one row (a preset's, not a check). */
    refuse: boolean
    network: LabNetwork
}

export const LAB_USER = 'labUser0001'

// The docs' DHIS2 ids, so Live DHIS2 opens the same examples there.
const NGELEHUN = 'DiszpKrYNg8'
const KOLISOKOR = 'm7fBMpmVpSM'
const INPATIENT = 'eBAyeGv0exc'
const RMNCH = 'WSGAb5XwJ3Y'
const SECOND_VISIT = 'edqlbukwRfQ'
const PERSON_ENROLLMENT = 'PE6abx7Zhn0'

const IMMUNISATION = 'ImmReg00001'
const IMM_STAGE = 'ImmVaccin01'

// One date column for a dose: the vaccination event of this vaccine and dose.
const dose = (vaccine: string, dose: string, label = dose) => ({
    field: {
        stage: IMM_STAGE,
        where: { ImmVaccine1: vaccine, ImmDose0001: dose },
        eventDate: true as const,
    },
    label,
})

/** The docs' immunisation register example's paper, the lab's own copy: that module needs a browser to import. */
const immunisationLayout: RegisterLayout = {
    columns: [
        {
            group: 'Child',
            children: [
                { field: { attribute: 'w75KJ2mc4zz' } },
                { field: { attribute: 'zDhUuAYrxNC' } },
                { field: { attribute: 'gHGyrwKPzej' } },
                { field: { attribute: 'cejWyOfXge6' } },
            ],
        },
        {
            group: 'Registered',
            children: [{ field: { enrollment: 'enrolledAt' }, label: 'Date' }],
        },
        { group: 'BCG', children: [dose('BCG', '0', 'Dose 0')] },
        {
            group: 'OPV',
            children: [dose('OPV', '1'), dose('OPV', '2'), dose('OPV', '3')],
        },
        {
            group: 'DPT',
            children: [dose('DPT', '1'), dose('DPT', '2'), dose('DPT', '3')],
        },
        { group: 'Measles', children: [dose('MEASLES', '1', 'Dose 1')] },
    ],
}

/** Each example's source options; module constants, since new options load the form again. */
export const SOURCES = {
    inpatient: { programId: INPATIENT, orgUnitId: NGELEHUN, pageSize: 10 },
    person: {
        programId: RMNCH,
        orgUnitId: KOLISOKOR,
        enrollmentId: PERSON_ENROLLMENT,
        newRowStageId: SECOND_VISIT,
        order: 'occurredAt:asc',
    },
    immunisation: {
        programId: IMMUNISATION,
        orgUnitId: NGELEHUN,
        enrolledFrom: '2026-10-01',
        enrolledTo: '2026-10-31',
        layout: immunisationLayout,
    },
} satisfies Record<Example, EventSourceOptions | RegisterSourceOptions>

export interface LabEvent {
    event: string
    program: string
    programStage: string
    orgUnit: string
    enrollment?: string
    occurredAt?: string
    scheduledAt?: string
    status: string
    dataValues: Array<{ dataElement: string; value: string }>
}

export interface LabEnrollment {
    enrollment: string
    program: string
    trackedEntity: string
    orgUnit: string
    enrolledAt: string
    occurredAt?: string
    status: string
}

export interface LabPerson {
    trackedEntity: string
    trackedEntityType: string
    orgUnit: string
    attributes: Array<{ attribute: string; value: string }>
}

interface LabProgramData {
    /** As `programs/<id>` answers it, with every field any of the block's program queries asks for. */
    program: { id: string }
    events: LabEvent[]
    enrollments: LabEnrollment[]
    people: LabPerson[]
    rules: object[]
    variables: object[]
    /** The records of the row the import refuses when `refuse` is on; an event of a refused enrolment is refused too. */
    refused: string[]
}

type Options = ReadonlyArray<readonly [code: string, name: string]>

const dataElement = (
    id: string,
    name: string,
    valueType: string,
    options?: Options
) => ({
    id,
    displayFormName: name,
    valueType,
    ...(options && {
        optionSet: {
            options: options.map(([code, name]) => ({
                code,
                displayName: name,
            })),
        },
    }),
})

type DataElement = ReturnType<typeof dataElement>

const stage = (
    id: string,
    name: string,
    elements: Array<[DataElement, compulsory?: boolean]>,
    changes: { repeatable?: boolean; blockEntryForm?: boolean } = {}
) => ({
    id,
    name,
    displayName: name,
    repeatable: false,
    validationStrategy: 'ON_UPDATE_AND_INSERT',
    blockEntryForm: false,
    ...changes,
    access: { data: { write: true } },
    programStageDataElements: elements.map(([element, compulsory]) => ({
        compulsory: compulsory ?? false,
        dataElement: element,
    })),
    programStageSections: [],
})

const program = (
    id: string,
    name: string,
    programType: string,
    programStages: Array<ReturnType<typeof stage>>
) => ({
    id,
    name,
    displayName: name,
    programType,
    expiryDays: 0,
    completeEventsExpiryDays: 0,
    categoryCombo: { id: 'bjDvmb4bfuf', isDefault: true },
    programStages,
})

/** A rule variable on a data element of the current event. */
const variable = (name: string, element: DataElement) => ({
    id: `var${name}`.slice(0, 11),
    name,
    programRuleVariableSourceType: 'DATAELEMENT_CURRENT_EVENT',
    useCodeForOptionSet: false,
    valueType: element.valueType,
    dataElement: {
        id: element.id,
        valueType: element.valueType,
        ...(element.optionSet && {
            optionSet: {
                id: `${element.id.slice(0, 8)}Opt`,
                options: element.optionSet.options.map(
                    ({ code, displayName }) => ({ code, name: displayName })
                ),
            },
        }),
    },
})

const rule = (
    id: string,
    name: string,
    condition: string,
    action: {
        programRuleActionType: string
        content?: string
        dataElement: { id: string }
    }
) => ({
    id,
    name,
    displayName: name,
    condition,
    programRuleActions: [{ id: `${id.slice(0, 10)}A`, ...action }],
})

const pad = (value: number, length = 2) => String(value).padStart(length, '0')
const day = (date: string) => `${date}T00:00:00.000`
// Inpatient morbidity and mortality, as the docs' DHIS2 has it, with six of its data elements.
const GENDER = dataElement('oZg33kd9taw', 'Gender', 'TEXT', [
    ['Male', 'Male'],
    ['Female', 'Female'],
])
const PREGNANT = dataElement('SWfdB5lX0fk', 'Pregnant', 'BOOLEAN')
const AGE = dataElement('qrur9Dvnyt5', 'Age (years)', 'INTEGER')
const WEIGHT = dataElement('vV9UWAZohSf', 'Weight in kg', 'INTEGER_POSITIVE')
const ADMITTED = dataElement('eMyVanycQSC', 'Date of admission', 'DATE')
const DISCHARGE = dataElement('fWIAEtYVEGk', 'Mode of Discharge', 'TEXT', [
    ['MODDISCH', 'Discharged'],
    ['MODDIED', 'Died'],
    ['MODTRANS', 'Transferred'],
    ['MODABSC', 'Absconded'],
])
const INPATIENT_STAGE = 'Zj7UnCAulEk'

const AGES = [34, 7, 61, 105, 28, 45, 2, 73, 19, 52, 38, 66, 11, 81]
const MODES = ['MODDISCH', 'MODDIED', 'MODTRANS', 'MODABSC']

/** Fourteen admissions two days apart, newest first: a page of ten and one more page. */
const inpatientEvents = (): LabEvent[] =>
    AGES.map((age, index) => {
        const female = index % 2 === 0
        const values: Array<[DataElement, string | undefined]> = [
            [GENDER, female ? 'Female' : 'Male'],
            [PREGNANT, female && index % 4 === 0 ? 'true' : undefined],
            [AGE, String(age)],
            [WEIGHT, String(age < 12 ? 8 + age * 3 : 50 + (age % 30))],
            [ADMITTED, `2026-10-${pad(28 - 2 * index)}`],
            // One active admission is missing a required value.
            [DISCHARGE, index === 1 ? undefined : MODES[index % MODES.length]],
        ]
        return {
            event: `LabInpEv${pad(index + 1, 3)}`,
            program: INPATIENT,
            programStage: INPATIENT_STAGE,
            orgUnit: NGELEHUN,
            occurredAt: day(`2026-10-${pad(30 - 2 * index)}`),
            status: index < 4 ? 'ACTIVE' : 'COMPLETED',
            dataValues: values.flatMap(([element, value]) =>
                value === undefined ? [] : [{ dataElement: element.id, value }]
            ),
        }
    })

const inpatient = (): LabProgramData => ({
    program: program(
        INPATIENT,
        'Inpatient morbidity and mortality',
        'WITHOUT_REGISTRATION',
        [
            stage(INPATIENT_STAGE, 'Inpatient morbidity and mortality', [
                [GENDER],
                [PREGNANT],
                [AGE],
                [WEIGHT],
                [ADMITTED, true],
                [DISCHARGE, true],
            ]),
        ]
    ),
    events: inpatientEvents(),
    enrollments: [],
    people: [],
    rules: [
        rule('labRulePrg1', 'Hide pregnancy for men', "#{gender} == 'Male'", {
            programRuleActionType: 'HIDEFIELD',
            dataElement: { id: PREGNANT.id },
        }),
        rule('labRuleAge1', 'Check the age', '#{age} > 100', {
            programRuleActionType: 'SHOWWARNING',
            content: 'Older than 100: is the age right?',
            dataElement: { id: AGE.id },
        }),
    ],
    variables: [variable('gender', GENDER), variable('age', AGE)],
    refused: ['LabInpEv001'],
})

// The WHO RMNCH Tracker's first and later antenatal visits, with three data elements each.
const HIV = dataElement('Itl05OEupgQ', 'HIV test result', 'TEXT', [
    ['POSITIVE', 'Positive'],
    ['NEGATIVE', 'Negative'],
    ['UNKNOWN', 'Unknown'],
])
const GESTATION = dataElement(
    'roKuXYfw1BW',
    'Gestational age at visit',
    'INTEGER'
)
const DIASTOLIC = dataElement(
    'dyYdfamSY2Z',
    'Diastolic blood pressure',
    'NUMBER'
)
const ECLAMPSIA = dataElement('w7enwqzx90I', 'Eclamptic convulsions', 'BOOLEAN')
const FIRST_VISIT = 'WZbXY0S00lP'
const PERSON = 'LabTei00001'

const visit = (
    event: string,
    programStage: string,
    date: string,
    status: string,
    values: Array<[DataElement, string]>
): LabEvent => ({
    event,
    program: RMNCH,
    programStage,
    orgUnit: KOLISOKOR,
    enrollment: PERSON_ENROLLMENT,
    occurredAt: day(date),
    status,
    dataValues: values.map(([element, value]) => ({
        dataElement: element.id,
        value,
    })),
})

const person = (): LabProgramData => ({
    program: program(RMNCH, 'WHO RMNCH Tracker', 'WITH_REGISTRATION', [
        stage(
            FIRST_VISIT,
            'First antenatal care visit',
            [[HIV], [GESTATION], [DIASTOLIC]],
            { blockEntryForm: true }
        ),
        stage(
            SECOND_VISIT,
            'Second antenatal care visit',
            [[GESTATION], [DIASTOLIC], [ECLAMPSIA]],
            { repeatable: true, blockEntryForm: true }
        ),
    ]),
    events: [
        // Completed in a stage that blocks entry: read-only until reopened.
        visit('Evahwp3zrQ4', FIRST_VISIT, '2026-03-12', 'COMPLETED', [
            [HIV, 'NEGATIVE'],
            [GESTATION, '12'],
            [DIASTOLIC, '78'],
        ]),
        visit('yDPqyTvcRpA', SECOND_VISIT, '2026-04-14', 'ACTIVE', [
            [GESTATION, '17'],
            [DIASTOLIC, '82'],
            [ECLAMPSIA, 'false'],
        ]),
        visit('fwaWno2Vvua', SECOND_VISIT, '2026-05-03', 'ACTIVE', [
            [GESTATION, '20'],
            [DIASTOLIC, '92'],
        ]),
        visit('e9ZV0b6ccCD', SECOND_VISIT, '2026-06-01', 'ACTIVE', [
            [GESTATION, '24'],
            [DIASTOLIC, '85'],
        ]),
    ],
    enrollments: [
        {
            enrollment: PERSON_ENROLLMENT,
            program: RMNCH,
            trackedEntity: PERSON,
            orgUnit: KOLISOKOR,
            enrolledAt: day('2026-03-12'),
            occurredAt: day('2026-03-12'),
            status: 'ACTIVE',
        },
    ],
    people: [
        {
            trackedEntity: PERSON,
            trackedEntityType: 'nEenWmSyUEp',
            orgUnit: KOLISOKOR,
            attributes: [
                { attribute: 'w75KJ2mc4zz', value: 'Mariama' },
                { attribute: 'zDhUuAYrxNC', value: 'Koroma' },
            ],
        },
    ],
    rules: [
        rule('labRuleBp01', 'High blood pressure', '#{diastolic} >= 90', {
            programRuleActionType: 'SHOWWARNING',
            content: 'Diastolic 90 or more: check for pre-eclampsia',
            dataElement: { id: DIASTOLIC.id },
        }),
    ],
    variables: [variable('diastolic', DIASTOLIC)],
    // The first visit is read-only, so the first row anyone can change.
    refused: ['yDPqyTvcRpA'],
})

// The child immunisation register the docs' DHIS2 is seeded with: one repeatable vaccination stage.
const VACCINE = dataElement('ImmVaccine1', 'Vaccine', 'TEXT', [
    ['BCG', 'BCG'],
    ['OPV', 'OPV'],
    ['DPT', 'DPT'],
    ['MEASLES', 'MEASLES'],
])
const DOSE = dataElement('ImmDose0001', 'Dose', 'TEXT', [
    ['0', '0'],
    ['1', '1'],
    ['2', '2'],
    ['3', '3'],
])
const IMM_ATTRIBUTES = {
    firstName: 'w75KJ2mc4zz',
    lastName: 'zDhUuAYrxNC',
    birthDate: 'gHGyrwKPzej',
    gender: 'cejWyOfXge6',
}

const attribute = (
    id: string,
    name: string,
    valueType: string,
    mandatory: boolean,
    options?: Options
) => ({
    mandatory,
    trackedEntityAttribute: {
        id,
        displayFormName: name,
        valueType,
        generated: false,
        unique: false,
        ...(options && {
            optionSet: {
                options: options.map(([code, name]) => ({
                    code,
                    displayName: name,
                })),
            },
        }),
    },
})

/** A child enrolled at Ngelehun in October, with the doses given so far. */
const child = (
    number: number,
    names: [first: string, last: string],
    gender: string,
    born: string,
    enrolled: string,
    doses: Array<[vaccine: string, dose: string, date: string]>
) => {
    const id = pad(number * 10, 5)
    const enrollment = `ImmEnr${id}`
    return {
        person: {
            trackedEntity: `ImmTei${id}`,
            trackedEntityType: 'nEenWmSyUEp',
            orgUnit: NGELEHUN,
            attributes: [
                { attribute: IMM_ATTRIBUTES.firstName, value: names[0] },
                { attribute: IMM_ATTRIBUTES.lastName, value: names[1] },
                { attribute: IMM_ATTRIBUTES.birthDate, value: born },
                { attribute: IMM_ATTRIBUTES.gender, value: gender },
            ],
        },
        enrollment: {
            enrollment,
            program: IMMUNISATION,
            trackedEntity: `ImmTei${id}`,
            orgUnit: NGELEHUN,
            enrolledAt: day(enrolled),
            occurredAt: day(enrolled),
            status: 'ACTIVE',
        },
        events: doses.map(([vaccine, dose, date], index): LabEvent => ({
            event: `ImmEvt${pad(number, 3)}${pad(index + 1)}`,
            program: IMMUNISATION,
            programStage: IMM_STAGE,
            orgUnit: NGELEHUN,
            enrollment,
            occurredAt: day(date),
            status: 'COMPLETED',
            dataValues: [
                { dataElement: VACCINE.id, value: vaccine },
                { dataElement: DOSE.id, value: dose },
            ],
        })),
    }
}

const CHILDREN = [
    child(1, ['Amara', 'Kamara'], 'Female', '2026-09-28', '2026-10-02', [
        ['BCG', '0', '2026-10-02'],
        ['OPV', '1', '2026-10-16'],
    ]),
    child(2, ['Musa', 'Bangura'], 'Male', '2026-10-01', '2026-10-09', [
        ['BCG', '0', '2026-10-09'],
        ['OPV', '1', '2026-10-16'],
        ['DPT', '1', '2026-10-23'],
    ]),
    child(3, ['Fatmata', 'Sesay'], 'Female', '2026-10-10', '2026-10-16', [
        ['BCG', '0', '2026-10-16'],
    ]),
    child(4, ['Ibrahim', 'Conteh'], 'Male', '2026-10-15', '2026-10-21', []),
]

const immunisationProgram = {
    id: IMMUNISATION,
    name: 'Child immunisation register',
    displayName: 'Child immunisation register',
    displayIncidentDate: false,
    expiryDays: 0,
    completeEventsExpiryDays: 0,
    access: { data: { write: true } },
    categoryCombo: { id: 'bjDvmb4bfuf', isDefault: true },
    trackedEntityType: {
        id: 'nEenWmSyUEp',
        access: { data: { write: true } },
    },
    programTrackedEntityAttributes: [
        attribute(IMM_ATTRIBUTES.firstName, 'First name', 'TEXT', true),
        attribute(IMM_ATTRIBUTES.lastName, 'Last name', 'TEXT', true),
        attribute(IMM_ATTRIBUTES.birthDate, 'Birth date', 'DATE', true),
        attribute(IMM_ATTRIBUTES.gender, 'Gender', 'TEXT', false, [
            ['Male', 'Male'],
            ['Female', 'Female'],
        ]),
    ],
    programStages: [
        {
            ...stage(IMM_STAGE, 'Vaccination', [[VACCINE], [DOSE]], {
                repeatable: true,
            }),
            validationStrategy: 'ON_COMPLETE',
            autoGenerateEvent: false,
            minDaysFromStart: 0,
            generatedByEnrollmentDate: false,
            openAfterEnrollment: false,
        },
    ],
}

const immunisation = (): LabProgramData => ({
    program: immunisationProgram,
    events: CHILDREN.flatMap(({ events }) => events),
    enrollments: CHILDREN.map(({ enrollment }) => enrollment),
    people: CHILDREN.map(({ person }) => person),
    // The register's program has no rules: its grid never loads the rule engine.
    rules: [],
    variables: [],
    refused: [
        CHILDREN[0].person.trackedEntity,
        CHILDREN[0].enrollment.enrollment,
    ],
})

/** A fresh server's data for one run: the program, its records by id for the run's imports to change. */
export const generateLabData = ({ example }: Pick<LabSettings, 'example'>) => {
    const { events, enrollments, people, ...program }: LabProgramData = {
        inpatient,
        person,
        immunisation,
    }[example]()
    return {
        ...program,
        events: new Map(events.map((each) => [each.event, each])),
        enrollments: new Map(
            enrollments.map((each) => [each.enrollment, each])
        ),
        people: new Map(people.map((each) => [each.trackedEntity, each])),
    }
}

export type LabData = ReturnType<typeof generateLabData>
