import {
    ADDRESS,
    ALLERGIES,
    BATCH,
    BIRTH_DATE,
    BLOOD_GROUP,
    BROKEN_ALLERGIES,
    BROKEN_LAST,
    CARRIER,
    CIVIL_STATUS,
    DESTINATION,
    DISTRICT,
    DOSES,
    EDUCATION,
    EMAIL,
    EXPIRY,
    FIRST_NAME,
    GENDER,
    INSURANCE,
    KIN_PHONE,
    LANGUAGE,
    LAST_NAME,
    MOBILE,
    NATIONAL_ID,
    NET_USE,
    NEXT_OF_KIN,
    OCCUPATION,
    SHIPMENT_NUMBER,
    UNIQUE_ID,
    VACCINE,
    VILLAGE,
    VVM,
} from './labAttributes'
import { LAB_PROGRAM } from '../observation-cards/labData'
import type { LabSettings } from './labData'
import {
    relationshipPartsFor,
    type RelationshipParts,
} from './labRelationships'

/** The parts the canvases place, as the person's own attribute uids. */
export interface Parts {
    name: string[]
    date: { attribute: string } | { enrollmentDate: 'occurredAt' }
    identifier: string
    /** An attribute the person's program lists, shown as a fact. */
    fact: string
    /** A data element of the person's visits, shown beside the facts. */
    haemoglobin?: string
    /** The host's buttons, in order. */
    actions: string[]
    /** Further attributes placed on line one. */
    more: string[]
    relationships?: RelationshipParts
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
    parts: Omit<Parts, 'actions' | 'more'>
    /** The host's buttons for this kind of record; a person's by default. */
    actions?: string[]
}

const PERSON_ACTIONS = ['Record visit', 'Add note', 'Refer', 'Transfer']

const COMMON = { name: [FIRST_NAME, LAST_NAME], identifier: UNIQUE_ID }

interface Subjects {
    child: Subject
    pregnancy: Subject
    adult: Subject
    long: Subject
    empty: Subject
    broken: Subject
    amharic: Subject
    arabic: Subject
    detailed: Subject
    shipment: Subject
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
            date: { enrollmentDate: 'occurredAt' },
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
            date: { attribute: BIRTH_DATE },
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
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    long: {
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
        values: {
            // One unbroken token, to test wrapping.
            [UNIQUE_ID]: 'SLANC2026WESTERNAREARURAL000918273645',
            [FIRST_NAME]: 'Mary-Elizabeth Ngozi Adaeze Oluwakemi',
            [LAST_NAME]: 'Bankole-Williams-Fitzgerald',
            [MOBILE]: '+232 76 123456 / +232 88 654321',
            // A leap day.
            [BIRTH_DATE]: '1988-02-29',
            // LATEX is not an option of the set: a code the program has since removed.
            [ALLERGIES]: 'Penicillin,SULFA,NSAIDS,LATEX',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 45,
            occurredDaysAgo: 45,
        },
        parts: {
            ...COMMON,
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    empty: {
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
        // Registered with nothing recorded, not even a name.
        values: {},
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 2,
            occurredDaysAgo: 2,
        },
        parts: {
            ...COMMON,
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    broken: {
        program: 'labAdultPrg',
        programName: 'Chronic care',
        type: 'labPersonTyp',
        typeName: 'Person',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            BROKEN_LAST,
            MOBILE,
            BIRTH_DATE,
            BROKEN_ALLERGIES,
        ],
        values: {
            [UNIQUE_ID]: '5521907',
            [FIRST_NAME]: 'Fatmata',
            [BROKEN_LAST]: 'Sesay',
            [BIRTH_DATE]: '1979-07-14',
            [BROKEN_ALLERGIES]: 'Penicillin',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 200,
            occurredDaysAgo: 200,
        },
        parts: {
            name: [FIRST_NAME, BROKEN_LAST],
            identifier: UNIQUE_ID,
            date: { attribute: BIRTH_DATE },
            fact: BROKEN_ALLERGIES,
        },
    },
    amharic: {
        program: 'labAncEthPr',
        programName: 'የቅድመ ወሊድ ክትትል',
        type: 'labPersonTyp',
        typeName: 'ሰው',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            LAST_NAME,
            MOBILE,
            BIRTH_DATE,
            ALLERGIES,
        ],
        values: {
            [UNIQUE_ID]: '7730041',
            [FIRST_NAME]: 'ሰላማዊት',
            [LAST_NAME]: 'ተስፋዬ',
            [MOBILE]: '+251 91 123 4567',
            // Pagume 6, 1987: the extra 13th-month day of an Ethiopian leap year.
            [BIRTH_DATE]: '1995-09-11',
            [ALLERGIES]: 'NSAIDS',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 90,
            occurredDaysAgo: 90,
        },
        parts: {
            ...COMMON,
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    arabic: {
        program: 'labAncArbPr',
        programName: 'رعاية ما قبل الولادة',
        type: 'labPersonTyp',
        typeName: 'شخص',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            LAST_NAME,
            MOBILE,
            BIRTH_DATE,
            ALLERGIES,
        ],
        values: {
            // Latin digits inside right-to-left text.
            [UNIQUE_ID]: '5520193',
            [FIRST_NAME]: 'فاطمة',
            [LAST_NAME]: 'عبد الرحمن',
            [MOBILE]: '+249 91 234 5678',
            [BIRTH_DATE]: '1993-04-17',
            [ALLERGIES]: 'Penicillin,NSAIDS',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 60,
            occurredDaysAgo: 60,
        },
        parts: {
            ...COMMON,
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    detailed: {
        program: 'labAdultPrg',
        programName: 'Chronic care',
        type: 'labPersonTyp',
        typeName: 'Person',
        attributes: [
            UNIQUE_ID,
            FIRST_NAME,
            LAST_NAME,
            GENDER,
            MOBILE,
            BIRTH_DATE,
            ALLERGIES,
            NATIONAL_ID,
            ADDRESS,
            VILLAGE,
            DISTRICT,
            OCCUPATION,
            EDUCATION,
            CIVIL_STATUS,
            NEXT_OF_KIN,
            KIN_PHONE,
            BLOOD_GROUP,
            LANGUAGE,
            NET_USE,
            EMAIL,
            INSURANCE,
        ],
        // Everything but an email address and insurance number.
        values: {
            [UNIQUE_ID]: '6023117',
            [FIRST_NAME]: 'Abu',
            [LAST_NAME]: 'Conteh',
            [GENDER]: 'M',
            [MOBILE]: '+232 77 845210',
            [BIRTH_DATE]: '1971-08-03',
            [ALLERGIES]: 'SULFA',
            [NATIONAL_ID]: 'SL-1971-0803-4471',
            [ADDRESS]: '14 Hangha Road, behind the Kenema central mosque',
            [VILLAGE]: 'Nyandeyama',
            [DISTRICT]: 'Kenema',
            [OCCUPATION]: 'Diamond miner',
            [EDUCATION]: 'PRIMARY',
            [CIVIL_STATUS]: 'MARRIED',
            [NEXT_OF_KIN]: 'Hawa Conteh (wife)',
            [KIN_PHONE]: '+232 76 300418',
            [BLOOD_GROUP]: 'O+',
            [LANGUAGE]: 'Mende',
            [NET_USE]: '4',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 700,
            occurredDaysAgo: 700,
        },
        parts: {
            ...COMMON,
            date: { attribute: BIRTH_DATE },
            fact: ALLERGIES,
        },
    },
    shipment: {
        program: 'labVaxShipP',
        programName: 'Vaccine shipments',
        incidentDateLabel: 'Dispatched',
        type: 'labShipmTyp',
        typeName: 'Shipment',
        attributes: [
            SHIPMENT_NUMBER,
            VACCINE,
            BATCH,
            DOSES,
            EXPIRY,
            VVM,
            DESTINATION,
            CARRIER,
        ],
        values: {
            [SHIPMENT_NUMBER]: 'SHP-2026-0412',
            [VACCINE]: 'MR',
            [BATCH]: 'MR-23-0918',
            [DOSES]: '2400',
            [EXPIRY]: '2027-03-31',
            [VVM]: '2',
            [DESTINATION]: 'Kenema District Hospital',
            [CARRIER]: 'National cold chain van 3',
        },
        enrollment: {
            status: 'ACTIVE',
            enrolledDaysAgo: 2,
            occurredDaysAgo: 3,
        },
        parts: {
            name: [VACCINE, SHIPMENT_NUMBER],
            date: { enrollmentDate: 'occurredAt' },
            identifier: BATCH,
            fact: VVM,
        },
        actions: ['Receive', 'Report damage', 'Move'],
    },
}

/** What the canvases place for this lab person and these settings. */
export const partsFor = (settings: LabSettings): Parts => {
    const subject = SUBJECTS[settings.record]
    const actions = subject.actions ?? PERSON_ACTIONS
    const { name, date, identifier, fact } = subject.parts
    const placed = [
        ...name,
        'attribute' in date ? date.attribute : '',
        identifier,
        fact,
    ]
    const relationships = relationshipPartsFor(settings.relationships)
    return {
        ...subject.parts,
        ...(relationships && { relationships }),
        actions: settings.actions === 'one' ? actions.slice(0, 1) : actions,
        more:
            settings.lineOne === 'more'
                ? subject.attributes
                      .filter((id) => !placed.includes(id))
                      .slice(0, 8)
                : [],
    }
}

/** The docs example's person and parts on the Sierra Leone demo (WHO RMNCH Tracker). */
export const LIVE_PARTS: Parts = {
    name: ['w75KJ2mc4zz', 'zDhUuAYrxNC'],
    date: { attribute: 'gHGyrwKPzej' },
    identifier: 'lZGmxYbs97q',
    fact: 'gu1fqsmoU8r',
    haemoglobin: 'vANAXwtLwcT',
    actions: PERSON_ACTIONS.slice(0, 1),
    more: [],
}
