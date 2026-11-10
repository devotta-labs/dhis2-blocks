import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { LabNetwork } from '../network'
import { generateLabData as generateObservationData } from '../observation-cards/labData'
import { DEFAULT_SETTINGS as OBSERVATION_DEFAULTS } from '../observation-cards/presets'

import { LAB_PERSON, LAB_PROGRAM } from '../observation-cards/labData'

// Everyone in the lab is the observation cards lab's one person, so the pregnancy person has visits to show.
export { LAB_PERSON }

type LabPerson = 'child' | 'pregnancy' | 'adult'

export interface LabSettings {
    person: LabPerson
    inactive: boolean
    potentialDuplicate: boolean
    /** The server refuses the person with a 403. */
    restricted: boolean
    calendar: Dhis2Calendar
    /** The default banner, or the parts composed by hand. */
    arrangement: 'default' | 'composed'
    width: 'narrow' | 'wide'
    network: LabNetwork
}

const FIRST_NAME = 'labFirstNam'
const LAST_NAME = 'labLastName'
const BIRTH_DATE = 'labBirthDat'
const UNIQUE_ID = 'labUniqueId'
const GENDER = 'labGender01'
const MOBILE = 'labMobile01'
const ALLERGIES = 'labAllergie'

interface AttributeSpec {
    label: string
    valueType: string
    options?: Array<[code: string, displayName: string]>
    displayInList: boolean
}

const ATTRIBUTES = new Map<string, AttributeSpec>(
    Object.entries({
        [UNIQUE_ID]: {
            label: 'Unique ID',
            valueType: 'TEXT',
            displayInList: true,
        },
        [FIRST_NAME]: {
            label: 'First name',
            valueType: 'TEXT',
            displayInList: true,
        },
        [LAST_NAME]: {
            label: 'Last name',
            valueType: 'TEXT',
            displayInList: true,
        },
        [GENDER]: {
            label: 'Sex',
            valueType: 'TEXT',
            options: [
                ['F', 'Female'],
                ['M', 'Male'],
            ],
            displayInList: true,
        },
        [MOBILE]: {
            label: 'Mobile number',
            valueType: 'PHONE_NUMBER',
            displayInList: true,
        },
        [BIRTH_DATE]: {
            label: 'Birth date',
            valueType: 'DATE',
            displayInList: false,
        },
        [ALLERGIES]: {
            label: 'Allergies',
            valueType: 'MULTI_TEXT',
            options: [
                ['Penicillin', 'Penicillin and related antibiotics'],
                ['SULFA', 'Antibiotics containing sulfonamides (sulfa drugs)'],
                ['NSAIDS', 'Aspirin, ibuprofen and other NSAIDs'],
            ],
            displayInList: true,
        },
    })
)

const specOf = (id: string): AttributeSpec => {
    const spec = ATTRIBUTES.get(id)
    if (!spec) throw new Error(`The lab has no attribute ${id}`)
    return spec
}

/** The parts the canvases place, as the person's own attribute uids. */
export interface Parts {
    name: string[]
    born: { attribute: string } | { enrollmentDate: 'occurredAt' }
    identifier: string
    /** An attribute the person's program lists, shown as a fact. */
    fact: string
    /** A data element of the person's visits, shown beside the facts. */
    haemoglobin?: string
}

interface Subject {
    program: string
    programName: string
    /** What the program calls the enrollment's incident date. */
    incidentDateLabel?: string
    type: string
    typeName: string
    /** The program's attributes, in order; the type keeps the first three. */
    attributes: string[]
    values: Record<string, string>
    enrollment: {
        status: 'ACTIVE' | 'COMPLETED'
        enrolledDaysAgo: number
        occurredDaysAgo: number
        completedDaysAgo?: number
    }
    parts: Parts
}

const COMMON = { name: [FIRST_NAME, LAST_NAME], identifier: UNIQUE_ID }

interface Subjects {
    child: Subject
    pregnancy: Subject
    adult: Subject
}

export const SUBJECTS: Subjects = {
    child: {
        program: 'labChildPrg',
        programName: 'Child Programme',
        incidentDateLabel: 'Date of birth',
        type: 'labPersonTyp',
        typeName: 'Person',
        attributes: [UNIQUE_ID, FIRST_NAME, LAST_NAME, GENDER],
        values: {
            [UNIQUE_ID]: '4180255',
            [FIRST_NAME]: 'Amara',
            [LAST_NAME]: 'Kamara',
            [GENDER]: 'F',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 60,
            occurredDaysAgo: 400,
        },
        parts: {
            ...COMMON,
            born: { enrollmentDate: 'occurredAt' },
            fact: GENDER,
        },
    },
    pregnancy: {
        program: LAB_PROGRAM,
        programName: 'Antenatal care',
        type: 'labPersonTyp',
        typeName: 'Person',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            LAST_NAME,
            MOBILE,
            BIRTH_DATE,
            ALLERGIES,
        ],
        values: {
            [UNIQUE_ID]: '9411202',
            [FIRST_NAME]: 'Linda',
            [LAST_NAME]: 'Bailey',
            [MOBILE]: '+232 76 123456',
            [BIRTH_DATE]: '1992-05-28',
            [ALLERGIES]: 'Penicillin,NSAIDS',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 120,
            occurredDaysAgo: 120,
        },
        parts: {
            ...COMMON,
            born: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
            haemoglobin: 'labCardDe01',
        },
    },
    adult: {
        program: 'labAdultPrg',
        programName: 'Chronic care',
        type: 'labPersonTyp',
        typeName: 'Person',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            LAST_NAME,
            MOBILE,
            BIRTH_DATE,
            ALLERGIES,
        ],
        // No birth date, identifier or allergies were ever recorded.
        values: { [FIRST_NAME]: 'Tamba', [LAST_NAME]: 'Koroma' },
        enrollment: {
            status: 'COMPLETED',
            enrolledDaysAgo: 300,
            occurredDaysAgo: 300,
            completedDaysAgo: 30,
        },
        parts: {
            ...COMMON,
            born: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
}

/** The docs example's person and parts on the Sierra Leone demo (WHO RMNCH Tracker). */
export const LIVE_PARTS: Parts = {
    name: ['w75KJ2mc4zz', 'zDhUuAYrxNC'],
    born: { attribute: 'gHGyrwKPzej' },
    identifier: 'lZGmxYbs97q',
    fact: 'gu1fqsmoU8r',
    haemoglobin: 'vANAXwtLwcT',
}

const ORG_UNIT = 'labOrgUnit1'

const isoToday = () => new Date().toLocaleDateString('sv')

const daysAgo = (today: string, days: number) => {
    const date = new Date(`${today}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() - days)
    return `${date.toISOString().slice(0, 10)}T12:00:00.000`
}

const attributeJson = (id: string) => {
    const { label, valueType, options } = specOf(id)
    return {
        id,
        displayFormName: label,
        valueType,
        ...(options && {
            optionSet: {
                options: options.map(([code, displayName]) => ({
                    code,
                    displayName,
                })),
            },
        }),
    }
}

/** Everything the lab's DHIS2 holds for its one person, as the block's requests see it. */
export const generateLabData = (settings: LabSettings, today = isoToday()) => {
    const subject = SUBJECTS[settings.person]
    const { enrollment } = subject
    const personJson = (withProgram: boolean) => ({
        trackedEntity: LAB_PERSON,
        trackedEntityType: subject.type,
        orgUnit: ORG_UNIT,
        inactive: settings.inactive,
        potentialDuplicate: settings.potentialDuplicate,
        attributes: subject.attributes
            .filter(
                (id, index) =>
                    id in subject.values && (withProgram || index < 3)
            )
            .map((id) => ({
                attribute: id,
                displayName: specOf(id).label,
                valueType: specOf(id).valueType,
                value: subject.values[id],
            })),
        enrollments: withProgram
            ? [
                  {
                      enrollment: 'labEnrolmnt1',
                      program: subject.program,
                      status: enrollment.status,
                      orgUnit: ORG_UNIT,
                      enrolledAt: daysAgo(today, enrollment.enrolledDaysAgo),
                      occurredAt: daysAgo(today, enrollment.occurredDaysAgo),
                      ...(enrollment.completedDaysAgo !== undefined && {
                          completedAt: daysAgo(
                              today,
                              enrollment.completedDaysAgo
                          ),
                      }),
                      followUp: false,
                  },
              ]
            : [],
        programOwners: withProgram
            ? [{ orgUnit: ORG_UNIT, program: subject.program }]
            : [],
    })
    const listed = (ids: string[]) =>
        ids.map((id, index) => ({
            displayInList: specOf(id).displayInList,
            sortOrder: index + 1,
            trackedEntityAttribute: attributeJson(id),
        }))
    const observations = generateObservationData(
        { ...OBSERVATION_DEFAULTS, calendar: settings.calendar },
        today
    )
    return {
        person: { withProgram: personJson(true), without: personJson(false) },
        program: {
            displayName: subject.programName,
            accessLevel: 'PROTECTED',
            ...(subject.incidentDateLabel && {
                incidentDateLabel: subject.incidentDateLabel,
            }),
            enrollmentDateLabel: 'Date of enrollment',
            trackedEntityType: { displayName: subject.typeName },
            programTrackedEntityAttributes: listed(subject.attributes),
            // The observation cards' stages and data elements, for the facts line.
            ...(settings.person === 'pregnancy' && {
                programStages: observations.program.programStages,
            }),
        },
        type: {
            displayName: subject.typeName,
            trackedEntityTypeAttributes: listed(
                subject.attributes.slice(0, 3)
            ).map(({ displayInList, trackedEntityAttribute }) => ({
                displayInList,
                trackedEntityAttribute,
            })),
        },
        observations,
        systemInfo: observations.systemInfo,
    }
}

export type LabData = ReturnType<typeof generateLabData>
