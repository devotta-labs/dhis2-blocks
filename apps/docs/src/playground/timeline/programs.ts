/** The lab's DHIS2 metadata: three programs a person can be enrolled in, their stages, data elements and attributes. */

export const NGELEHUN = 'labOuNgelh1'
const BO_HOSPITAL = 'labOuBoHsp1'
const NJALA = 'labOuNjala1'

/** Every org unit the lab's events can name, and its name. */
export const ORG_UNITS: ReadonlyMap<string, string> = new Map([
    [NGELEHUN, 'Ngelehun CHC'],
    [BO_HOSPITAL, 'Bo Government Hospital'],
    [NJALA, 'Njala outreach post'],
])

/** The user snapshot on events, enrollments and changelog rows. */
export const NURSE = {
    uid: 'labUserNrs1',
    username: 'fatima.kamara',
    firstName: 'Fatima',
    surname: 'Kamara',
}
export const CLERK = {
    uid: 'labUserClk1',
    username: 'ibrahim.sesay',
    firstName: 'Ibrahim',
    surname: 'Sesay',
}

export type User = typeof NURSE

/** The attributes of the person type, shared by every program. */
export const FIRST_NAME = 'labAttFirst'
export const SURNAME = 'labAttLast1'
export const BIRTH_DATE = 'labAttDob01'
export const PHONE = 'labAttPhone'
export const ADDRESS = 'labAttAddr1'
export const NCD_NUMBER = 'labAttNcd01'

interface AttributeSpec {
    id: string
    name: string
    valueType: string
}

const TYPE_ATTRIBUTES: AttributeSpec[] = [
    { id: FIRST_NAME, name: 'First name', valueType: 'TEXT' },
    { id: SURNAME, name: 'Last name', valueType: 'TEXT' },
    { id: BIRTH_DATE, name: 'Date of birth', valueType: 'DATE' },
    { id: PHONE, name: 'Phone number', valueType: 'PHONE_NUMBER' },
]

interface ValueContext {
    /** The event's place in its enrollment, oldest first. */
    index: number
    /** The event's day, `YYYY-MM-DD`. */
    day: string
    random: () => number
}

export interface ElementSpec {
    id: string
    name: string
    /** The shorter label forms and the timeline show. */
    formName?: string
    valueType: string
    options?: ReadonlyArray<readonly [string, string]>
    /** Shown on the event; the rest only appear in its changes. */
    inReports: boolean
    value: (context: ValueContext) => string | undefined
}

export interface StageSpec {
    id: string
    name: string
    repeatable: boolean
    hideDueDate: boolean
    elements: ElementSpec[]
}

export interface ProgramSpec {
    id: string
    name: string
    enrollmentDateLabel: string
    incidentDateLabel?: string
    /** Days between the incident date and enrolment, when the program has one. */
    incidentBefore?: number
    /** The stage of an enrollment's first event, when it has its own. */
    first?: StageSpec
    repeat: StageSpec
    /** The stage of a completed enrollment's last event. */
    closing?: StageSpec
    attributes: AttributeSpec[]
    orgUnitOf: (index: number) => string
    enrollmentNote: string
}

const between = (
    random: () => number,
    min: number,
    max: number,
    decimals = 0
) => (min + (max - min) * random()).toFixed(decimals)

const NEXT_STEPS = [
    ['REVIEW', 'Review in two weeks'],
    ['HOME', 'Continue care at home'],
    ['REFER', 'Refer to hospital'],
] as const

const CLINICIAN_NOTES = [
    'Feeling well, no complaints',
    'Mild headache, advised rest',
    'Swollen ankles, review next visit',
]

const haemoglobin: ElementSpec = {
    id: 'labDeHb0001',
    name: 'ANC Haemoglobin',
    formName: 'Haemoglobin (g/dL)',
    valueType: 'NUMBER',
    inReports: true,
    value: ({ random }) => between(random, 9.4, 12.8, 1),
}

const weight: ElementSpec = {
    id: 'labDeWt0001',
    name: 'ANC Weight',
    formName: 'Weight (kg)',
    valueType: 'NUMBER',
    inReports: true,
    value: ({ index, random }) =>
        between(random, 58 + index * 0.4, 60 + index * 0.4, 1),
}

const ANC: ProgramSpec = {
    id: 'labProgAnc1',
    name: 'Antenatal care',
    enrollmentDateLabel: 'Date of enrollment',
    incidentDateLabel: 'Last menstrual period',
    incidentBefore: 70,
    first: {
        id: 'labStgAnc01',
        name: 'First antenatal visit',
        repeatable: false,
        hideDueDate: false,
        elements: [
            haemoglobin,
            weight,
            {
                id: 'labDeGrav01',
                name: 'ANC Gravida',
                formName: 'Pregnancies, this one included',
                valueType: 'INTEGER_POSITIVE',
                inReports: true,
                value: () => '2',
            },
        ],
    },
    repeat: {
        id: 'labStgAnc02',
        name: 'Antenatal follow-up',
        repeatable: true,
        hideDueDate: false,
        elements: [
            haemoglobin,
            weight,
            {
                id: 'labDeDang01',
                name: 'ANC Danger signs',
                formName: 'Danger signs present',
                valueType: 'BOOLEAN',
                inReports: true,
                value: ({ random }) => (random() < 0.15 ? 'true' : 'false'),
            },
            {
                id: 'labDeNext01',
                name: 'ANC Next step',
                formName: 'Next step',
                valueType: 'TEXT',
                options: NEXT_STEPS,
                inReports: true,
                value: ({ index }) =>
                    NEXT_STEPS[index % NEXT_STEPS.length]?.[0],
            },
            {
                id: 'labDeNote01',
                name: 'ANC Clinician note',
                formName: 'Clinician note',
                valueType: 'LONG_TEXT',
                inReports: false,
                value: ({ index }) =>
                    CLINICIAN_NOTES[index % CLINICIAN_NOTES.length],
            },
        ],
    },
    closing: {
        id: 'labStgAnc03',
        name: 'Delivery',
        repeatable: false,
        hideDueDate: true,
        elements: [
            {
                id: 'labDeDelAt1',
                name: 'Delivered at',
                valueType: 'ORGANISATION_UNIT',
                inReports: true,
                value: () => BO_HOSPITAL,
            },
            {
                id: 'labDeOutc01',
                name: 'Delivery outcome',
                formName: 'Outcome',
                valueType: 'TEXT',
                options: [
                    ['LIVE', 'Live birth'],
                    ['STILL', 'Stillbirth'],
                ],
                inReports: true,
                value: () => 'LIVE',
            },
        ],
    },
    attributes: [
        ...TYPE_ATTRIBUTES,
        { id: ADDRESS, name: 'Home address', valueType: 'TEXT' },
    ],
    // Every third visit is at the outreach post.
    orgUnitOf: (index) => (index % 3 === 2 ? NJALA : NGELEHUN),
    enrollmentNote: 'Referred by the outreach team.',
}

const MEDICATION = [
    ['AMLO', 'Amlodipine 5 mg'],
    ['HCTZ', 'Hydrochlorothiazide 25 mg'],
    ['NONE', 'No medication'],
] as const

const HYPERTENSION: ProgramSpec = {
    id: 'labProgHtn1',
    name: 'Hypertension care',
    enrollmentDateLabel: 'Date of diagnosis',
    repeat: {
        id: 'labStgHtn01',
        name: 'Hypertension review',
        repeatable: true,
        hideDueDate: false,
        elements: [
            {
                id: 'labDeSys001',
                name: 'Systolic blood pressure',
                formName: 'Systolic (mmHg)',
                valueType: 'INTEGER_POSITIVE',
                inReports: true,
                value: ({ random }) => between(random, 124, 168),
            },
            {
                id: 'labDeDia001',
                name: 'Diastolic blood pressure',
                formName: 'Diastolic (mmHg)',
                valueType: 'INTEGER_POSITIVE',
                inReports: true,
                value: ({ random }) => between(random, 78, 102),
            },
            {
                id: 'labDeMed001',
                name: 'Hypertension medication',
                formName: 'Medication',
                valueType: 'TEXT',
                options: MEDICATION,
                inReports: true,
                value: ({ index }) => MEDICATION[index % 2]?.[0],
            },
            {
                id: 'labDeSmok01',
                name: 'Smokes tobacco',
                valueType: 'BOOLEAN',
                inReports: false,
                value: () => 'false',
            },
        ],
    },
    attributes: [
        ...TYPE_ATTRIBUTES,
        { id: NCD_NUMBER, name: 'NCD register number', valueType: 'TEXT' },
    ],
    orgUnitOf: () => BO_HOSPITAL,
    enrollmentNote: 'Prefers morning appointments.',
}

const MALARIA: ProgramSpec = {
    id: 'labProgMal1',
    name: 'Malaria case management',
    enrollmentDateLabel: 'Date of diagnosis',
    incidentDateLabel: 'Date of onset',
    incidentBefore: 3,
    first: {
        id: 'labStgMal01',
        name: 'Diagnosis',
        repeatable: false,
        hideDueDate: false,
        elements: [
            {
                id: 'labDeRdt001',
                name: 'Malaria test result',
                formName: 'Test result',
                valueType: 'TEXT',
                options: [
                    ['POS', 'Positive'],
                    ['NEG', 'Negative'],
                ],
                inReports: true,
                value: () => 'POS',
            },
            {
                id: 'labDeSpec01',
                name: 'Malaria species',
                formName: 'Species',
                valueType: 'TEXT',
                options: [
                    ['PF', 'Plasmodium falciparum'],
                    ['PV', 'Plasmodium vivax'],
                ],
                inReports: true,
                value: () => 'PF',
            },
        ],
    },
    repeat: {
        id: 'labStgMal02',
        name: 'Treatment follow-up',
        repeatable: true,
        hideDueDate: false,
        elements: [
            {
                id: 'labDeFev001',
                name: 'Fever',
                valueType: 'TRUE_ONLY',
                inReports: true,
                value: ({ index }) => (index < 2 ? 'true' : undefined),
            },
            {
                id: 'labDeTrt001',
                name: 'Malaria treatment',
                formName: 'Treatment',
                valueType: 'TEXT',
                inReports: true,
                value: () => 'Artemether-lumefantrine',
            },
        ],
    },
    attributes: TYPE_ATTRIBUTES,
    orgUnitOf: () => NGELEHUN,
    enrollmentNote: 'Lives two hours from the clinic.',
}

/** The programs the person can be enrolled in, in the order the lab adds them. */
export const LAB_PROGRAMS = [ANC, HYPERTENSION, MALARIA].map(
    ({ id, name }) => ({ id, name })
)

export const PROGRAMS = [ANC, HYPERTENSION, MALARIA]

const elementJson = (element: ElementSpec) => ({
    id: element.id,
    displayName: element.name,
    displayFormName: element.formName ?? element.name,
    valueType: element.valueType,
    optionSet: element.options && {
        options: element.options.map(([code, displayName]) => ({
            code,
            displayName,
        })),
    },
})

const stagesOf = (spec: ProgramSpec) =>
    [spec.first, spec.repeat, spec.closing].flatMap((stage) =>
        stage ? [stage] : []
    )

/** The program as `programs/{id}?fields=…` answers it. */
export const programJson = (spec: ProgramSpec) => ({
    id: spec.id,
    displayName: spec.name,
    displayEnrollmentDateLabel: spec.enrollmentDateLabel,
    displayIncidentDateLabel: spec.incidentDateLabel,
    programStages: stagesOf(spec).map((stage, index) => ({
        id: stage.id,
        displayName: stage.name,
        sortOrder: index + 1,
        hideDueDate: stage.hideDueDate,
        repeatable: stage.repeatable,
        programStageDataElements: stage.elements.map((element) => ({
            displayInReports: element.inReports,
            dataElement: elementJson(element),
        })),
    })),
    programTrackedEntityAttributes: spec.attributes.map((attribute) => ({
        trackedEntityAttribute: {
            id: attribute.id,
            displayName: attribute.name,
            displayFormName: attribute.name,
            valueType: attribute.valueType,
        },
    })),
})
