import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { LabNetwork } from '../network'

export const LAB_PROGRAM = 'labProgram1'
export const LAB_PERSON = 'labPerson01'
/** Each card's data element, by position; every stage captures all three. */
export const CARD_ELEMENTS = ['labCardDe01', 'labCardDe02', 'labCardDe03']
/** Data elements no stage of the lab program captures, one per card. */
export const NOT_IN_PROGRAM = ['labMissing1', 'labMissing2', 'labMissing3']
const VISIT_STAGE = 'labVisitStg'
const REVIEW_STAGE = 'labReviewSt'

// Legend colours as a DHIS2 admin might set them, each dark or light enough for black or white text to pass AA.
const RED = '#c62828'
const ORANGE = '#ef6c00'
const YELLOW = '#fbc02d'
const GREEN = '#2e7d32'

interface Domain {
    min: number
    max: number
    decimals: number
    /** Band starts, ascending, then the last band's end; no legend set without them. */
    bands?: number[]
    names?: string[]
    /** Each band's colour, by what it means rather than its position. */
    colours?: string[]
}

interface ElementSpec {
    name: string
    valueType: string
    unit?: string
    /** The unit spelled out, for the long label. */
    longUnit?: string
    domain?: Domain
    /** Coded 1–4 with an option set, like RMNCH's numeric option codes. */
    options?: boolean
}

/** The data elements a card can show, each with the readings the lab makes up for it. */
const ELEMENTS = {
    haemoglobin: {
        name: 'Haemoglobin',
        valueType: 'NUMBER',
        unit: 'g/dL',
        longUnit: 'grams per decilitre',
        domain: {
            min: 6,
            max: 16,
            decimals: 1,
            bands: [0, 7, 10, 11, 25],
            names: [
                'Severe anaemia',
                'Moderate anaemia',
                'Mild anaemia',
                'Normal',
            ],
            colours: [RED, ORANGE, YELLOW, GREEN],
        },
    },
    weight: {
        name: 'Weight',
        valueType: 'NUMBER',
        unit: 'kg',
        longUnit: 'kilograms',
        domain: { min: 58, max: 70, decimals: 1 },
    },
    systolic: {
        name: 'Systolic blood pressure',
        valueType: 'INTEGER_POSITIVE',
        unit: 'mmHg',
        longUnit: 'millimetres of mercury',
        domain: {
            min: 85,
            max: 175,
            decimals: 0,
            bands: [0, 90, 120, 140, 300],
            names: ['Low', 'Normal', 'Elevated', 'High'],
            colours: [YELLOW, GREEN, ORANGE, RED],
        },
    },
    saturation: {
        name: 'Oxygen saturation',
        valueType: 'PERCENTAGE',
        domain: {
            min: 82,
            max: 100,
            decimals: 0,
            bands: [0, 90, 95, 101],
            names: ['Low', 'Borderline', 'Normal'],
            colours: [RED, YELLOW, GREEN],
        },
    },
    severity: {
        name: 'Anaemia severity',
        valueType: 'INTEGER_POSITIVE',
        options: true,
    },
    smoker: { name: 'Smokes tobacco', valueType: 'BOOLEAN' },
    dangerSigns: { name: 'Danger signs present', valueType: 'TRUE_ONLY' },
    note: { name: 'Clinician note', valueType: 'TEXT' },
    lmp: { name: 'Last menstrual period', valueType: 'DATE' },
    location: { name: 'Home location', valueType: 'COORDINATE' },
} satisfies Record<string, ElementSpec>

export type LabElement = keyof typeof ELEMENTS

const elementSpec = (element: LabElement): ElementSpec => ELEMENTS[element]

/** What the lab's DHIS2 holds for one card's data element. */
export interface LabCard {
    element: LabElement
    /** Numbers, and yes/no: climbing takes up the habit halfway, jumpy flips at random. */
    spread: 'steady' | 'flat' | 'climbing' | 'jumpy'
    /** For numbers with bands. */
    legendSet: boolean
    /** For option sets: style colours on the options. */
    optionColours: boolean
    /** For TRUE_ONLY: the latest visit leaves the box unticked. */
    trueOnlyUntick: boolean
    neverRecorded: boolean
    longLabel: boolean
    /** The card asks for a data element the program doesn't capture. */
    notInProgram: boolean
}

export interface LabSettings {
    /** Completed visits for the person (0–500); each records every card's value. */
    visits: number
    irregularVisits: boolean
    daysSinceLast: number
    /** The cards' `staleAfterDays`; 0 leaves it unset. */
    staleAfterDays: number
    /** The specialist review stage, every fourth visit, is not data-readable. */
    unreadableStage: boolean
    enrollments: number
    /** SCHEDULE and SKIPPED events carrying values that must not count. */
    scheduledSkipped: boolean
    calendar: Dhis2Calendar
    cards: LabCard[]
    cardWidth: number
    cardsPerRow: number
    arrangement: 'default' | 'composed'
    network: LabNetwork
}

const OPTIONS = [
    ['1', 'None', GREEN],
    ['2', 'Mild', YELLOW],
    ['3', 'Moderate', ORANGE],
    ['4', 'Severe', RED],
] as const

const NOTES = [
    'Feeling well',
    'Mild headache, advised rest',
    'Swollen ankles, review next visit',
    'No complaints',
]

/** The card's label and unit as the lab shows them. */
export const cardLabel = (card: LabCard) => {
    const { name, unit, longUnit } = elementSpec(card.element)
    if (!card.longLabel) return { label: name, unit }
    return {
        label: `${name} measured at the antenatal care visit by point-of-care test`,
        unit: longUnit ?? unit,
    }
}

/** mulberry32: a small seeded PRNG, so a preset always looks the same. */
const seeded = (seed: number) => {
    let state = seed
    return () => {
        state = (state + 0x6d2b79f5) | 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const addDays = (today: string, offset: number) => {
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
}

const isoToday = () => new Date().toLocaleDateString('sv')

const uid = (prefix: string, index: number) =>
    `${prefix}${String(index).padStart(11 - prefix.length, '0')}`

const round = (value: number, decimals: number) =>
    Number(value.toFixed(decimals))

/** Readings' numeric values, oldest first. */
const numericValues = (
    count: number,
    spread: LabCard['spread'],
    domain: Domain,
    random: () => number
) => {
    const mid = (domain.min + domain.max) / 2
    const range = domain.max - domain.min
    return Array.from({ length: count }, (_, index) => {
        const t = count <= 1 ? 1 : index / (count - 1)
        switch (spread) {
            case 'flat':
                return round(mid, domain.decimals)
            case 'climbing': {
                // Climbs through every band to land exactly on the top band's start, which belongs to that band.
                const top = domain.bands?.at(-2) ?? domain.max
                return round(
                    domain.min + (top - domain.min) * t,
                    domain.decimals
                )
            }
            case 'jumpy':
                return round(domain.min + range * random(), domain.decimals)
            default:
                return round(
                    mid + (random() - 0.5) * range * 0.15,
                    domain.decimals
                )
        }
    })
}

/** One card's values as the tracker API sends them, oldest first; undefined sends none. */
const cardValues = (
    card: LabCard,
    dates: string[],
    random: () => number
): Array<string | undefined> => {
    const spec: ElementSpec = ELEMENTS[card.element]
    if (card.neverRecorded) return dates.map(() => undefined)
    if (spec.options) {
        let code = 1
        return dates.map((_, index) => {
            code = Math.min(4, Math.max(1, code + Math.round(random() * 2 - 1)))
            // Ends on Moderate, so the latest shows a style colour.
            return index === dates.length - 1 ? '3' : String(code)
        })
    }
    if (spec.domain) {
        return numericValues(
            dates.length,
            card.spread,
            spec.domain,
            random
        ).map(String)
    }
    return dates.map((date, index) => {
        const last = index === dates.length - 1
        switch (spec.valueType) {
            case 'BOOLEAN':
                return booleanValue(card.spread, index, dates.length, random)
            case 'TRUE_ONLY':
                // An unticked TRUE_ONLY box sends no value at all.
                return last && card.trueOnlyUntick ? undefined : 'true'
            case 'DATE':
                return addDays(date, -20 - Math.floor(random() * 20))
            case 'COORDINATE':
                return '[-13.234,8.484]'
            default:
                return NOTES[index % NOTES.length]
        }
    })
}

const booleanValue = (
    spread: LabCard['spread'],
    index: number,
    count: number,
    random: () => number
) => {
    switch (spread) {
        case 'flat':
            return 'false'
        case 'climbing':
            // Took up the habit halfway, so the latest is Yes.
            return index >= count / 2 ? 'true' : 'false'
        case 'jumpy':
            return random() < 0.5 ? 'true' : 'false'
        default:
            return random() < 0.2 ? 'true' : 'false'
    }
}

/** Days between visits, oldest first. */
const gaps = (settings: LabSettings, count: number, random: () => number) =>
    Array.from({ length: count }, () =>
        settings.irregularVisits
            ? 3 + Math.floor(random() * 60)
            : 12 + Math.floor(random() * 5)
    )

const dataElementJson = (card: LabCard, index: number) => {
    const spec: ElementSpec = ELEMENTS[card.element]
    const bands = spec.domain?.bands
    const names = spec.domain?.names
    return {
        id: CARD_ELEMENTS[index],
        displayName: spec.name,
        displayFormName: cardLabel(card).label,
        valueType: spec.valueType,
        legendSets:
            card.legendSet && bands && names
                ? [
                      {
                          legends: names.map((name, band) => ({
                              name,
                              color: spec.domain?.colours?.[band],
                              startValue: bands[band],
                              endValue: bands[band + 1],
                          })),
                      },
                  ]
                : [],
        optionSet: spec.options
            ? {
                  options: OPTIONS.map(([code, name, color]) => ({
                      code,
                      name,
                      style: card.optionColours ? { color } : {},
                  })),
              }
            : undefined,
    }
}

const programJson = (settings: LabSettings) => {
    const dataElements = settings.cards.map((card, index) => ({
        dataElement: dataElementJson(card, index),
    }))
    return {
        id: LAB_PROGRAM,
        programStages: [
            {
                id: VISIT_STAGE,
                displayName: 'Antenatal visit',
                access: { data: { read: true } },
                programStageDataElements: dataElements,
            },
            {
                id: REVIEW_STAGE,
                displayName: 'Specialist review',
                access: { data: { read: !settings.unreadableStage } },
                programStageDataElements: dataElements,
            },
        ],
    }
}

interface LabEvent {
    event: string
    trackedEntity: string
    enrollment: string
    program: string
    programStage: string
    status: string
    occurredAt?: string
    scheduledAt?: string
    createdAt: string
    orgUnit: string
    dataValues: Array<{ dataElement: string; value: string }>
}

/**
 * Everything the lab's DHIS2 holds for its one person: the program, their
 * enrollments, the events the user can read (oldest first) and the system
 * info app-runtime hands the block.
 */
export const generateLabData = (settings: LabSettings, today = isoToday()) => {
    const random = seeded(20261102)
    const visits = Math.max(0, Math.min(500, Math.round(settings.visits)))
    const enrollmentCount = Math.max(1, Math.min(3, settings.enrollments))
    const steps = gaps(settings, visits, random)
    const dates: string[] = []
    let offset = -settings.daysSinceLast
    for (let index = visits - 1; index >= 0; index--) {
        dates.unshift(addDays(today, offset))
        offset -= steps[index] ?? 14
    }
    // Each card draws from its own sequence, so changing one card leaves the others' readings alone.
    const values = settings.cards.map((card, index) =>
        cardValues(card, dates, seeded(20261102 + 7919 * (index + 1)))
    )
    const enrollments = Array.from({ length: enrollmentCount }, (_, index) => ({
        enrollment: uid('labEnrol', index + 1),
        trackedEntity: LAB_PERSON,
        program: LAB_PROGRAM,
        status: index === enrollmentCount - 1 ? 'ACTIVE' : 'COMPLETED',
        enrolledAt: `${dates[Math.floor((index * visits) / enrollmentCount)] ?? today}T00:00:00.000`,
    }))
    const enrollmentOf = (index: number) =>
        enrollments[Math.floor((index * enrollmentCount) / Math.max(1, visits))]
            ?.enrollment ?? enrollments[0].enrollment
    const event = (
        index: number,
        fields: Pick<LabEvent, 'programStage' | 'status' | 'dataValues'> & {
            date: string
        }
    ): LabEvent => ({
        event: uid('labEvent', index),
        trackedEntity: LAB_PERSON,
        enrollment: enrollmentOf(Math.min(index, visits - 1)),
        program: LAB_PROGRAM,
        programStage: fields.programStage,
        status: fields.status,
        occurredAt: `${fields.date}T09:00:00.000`,
        createdAt: `${fields.date}T09:30:00.000`,
        orgUnit: 'labOrgUnit1',
        dataValues: fields.dataValues,
    })

    const events = dates.map((date, index) =>
        event(index, {
            date,
            // Every fourth visit is a specialist review.
            programStage: index % 4 === 3 ? REVIEW_STAGE : VISIT_STAGE,
            status: index === visits - 1 ? 'ACTIVE' : 'COMPLETED',
            dataValues: CARD_ELEMENTS.flatMap((dataElement, card) => {
                const value = values[card]?.[index]
                return value === undefined ? [] : [{ dataElement, value }]
            }),
        })
    )
    if (settings.scheduledSkipped) {
        // Values that would stand out if a SCHEDULE or SKIPPED event were counted.
        const outliers = settings.cards.map((card, index) => ({
            dataElement: CARD_ELEMENTS[index] ?? '',
            value: elementSpec(card.element).domain ? '999' : 'MUST NOT SHOW',
        }))
        const extra = dates.flatMap((date, index) =>
            index % 5 === 2
                ? [
                      event(visits + index, {
                          date: addDays(date, 2),
                          programStage: VISIT_STAGE,
                          status: 'SKIPPED',
                          dataValues: outliers,
                      }),
                  ]
                : []
        )
        extra.push(
            event(visits * 2, {
                date: addDays(today, 14),
                programStage: VISIT_STAGE,
                status: 'SCHEDULE',
                dataValues: outliers,
            })
        )
        events.push(...extra)
        events.sort((a, b) =>
            (a.occurredAt ?? '').localeCompare(b.occurredAt ?? '')
        )
    }

    return {
        program: programJson(settings),
        enrollments,
        // DHIS2 never sends events from a stage the user cannot read.
        events: events.filter(
            (each) =>
                !(
                    settings.unreadableStage &&
                    each.programStage === REVIEW_STAGE
                )
        ),
        systemInfo: {
            version: '2.42.0',
            contextPath: '',
            serverTimeZoneId: 'Etc/UTC',
            calendar: settings.calendar,
        },
    }
}

export type LabData = ReturnType<typeof generateLabData>
