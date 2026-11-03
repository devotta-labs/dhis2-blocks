import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { LabNetwork } from '../network'

export const LAB_PROGRAM = 'labProgram1'
export const LAB_PERSON = 'labPerson01'
/** The data element the settings shape; the first card shows it. */
export const SUBJECT = 'labSubject1'
/** A data element no stage of the lab program captures. */
export const NOT_IN_PROGRAM = 'labMissing1'
export const WEIGHT = 'labWeight01'
export const SMOKER = 'labSmoker01'
const VISIT_STAGE = 'labVisitStg'
const REVIEW_STAGE = 'labReviewSt'

type LabValueType =
    | 'NUMBER'
    | 'INTEGER_POSITIVE'
    | 'PERCENTAGE'
    | 'BOOLEAN'
    | 'TRUE_ONLY'
    | 'TEXT'
    | 'DATE'
    | 'COORDINATE'

export interface LabSettings {
    /** Readings of the first card's data element (0–500). */
    readings: number
    spread: 'steady' | 'flat' | 'crossing' | 'jumpy'
    valueType: LabValueType
    legendSet: boolean
    /** An option set on the data element, with or without style colours. */
    optionSet: 'none' | 'plain' | 'coloured'
    daysSinceLast: number
    /** The cards' `staleAfterDays`; 0 leaves it unset. */
    staleAfterDays: number
    /** A second stage capturing the element that the user cannot read. */
    unreadableStage: boolean
    enrollments: number
    /** SCHEDULE and SKIPPED events carrying values that must not count. */
    scheduledSkipped: boolean
    /** For TRUE_ONLY: the latest visit leaves the box unticked. */
    trueOnlyUntick: boolean
    calendar: Dhis2Calendar
    longLabel: boolean
    /** The first card asks for a data element the program doesn't capture. */
    notInProgram: boolean
    cardWidth: number
    cardsPerRow: number
    arrangement: 'default' | 'composed'
    network: LabNetwork
}

interface Domain {
    unit: string
    min: number
    max: number
    decimals: number
    /** Band starts, ascending, then the last band's end. */
    bands: number[]
    names: string[]
}

const BAND_COLOURS = ['#d32f2f', '#f57c00', '#fbc02d', '#388e3c']

const NUMERIC = new Map<LabValueType, Domain>([
    [
        'NUMBER',
        {
            unit: 'g/dL',
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
        },
    ],
    [
        'INTEGER_POSITIVE',
        {
            unit: 'mmHg',
            min: 85,
            max: 175,
            decimals: 0,
            bands: [0, 90, 120, 140, 300],
            names: ['Low', 'Normal', 'Elevated', 'High'],
        },
    ],
    [
        'PERCENTAGE',
        {
            unit: '%',
            min: 82,
            max: 100,
            decimals: 0,
            bands: [0, 90, 95, 101],
            names: ['Low', 'Borderline', 'Normal'],
        },
    ],
])

const LABELS = {
    NUMBER: 'Haemoglobin',
    INTEGER_POSITIVE: 'Systolic blood pressure',
    PERCENTAGE: 'Oxygen saturation',
    BOOLEAN: 'Smokes tobacco',
    TRUE_ONLY: 'Danger signs present',
    TEXT: 'Clinician note',
    DATE: 'Last menstrual period',
    COORDINATE: 'Home location',
} satisfies Record<LabValueType, string>

const LONG_LABEL =
    'Haemoglobin concentration measured at the antenatal care visit by point-of-care test'
const LONG_UNIT = 'grams per decilitre'

const OPTIONS = [
    ['1', 'None', '#388e3c'],
    ['2', 'Mild', '#fbc02d'],
    ['3', 'Moderate', '#f57c00'],
    ['4', 'Severe', '#d32f2f'],
] as const

const NOTES = [
    'Feeling well',
    'Mild headache, advised rest',
    'Swollen ankles, review next visit',
    'No complaints',
]

/** The card's label and unit as the lab shows them. */
export const subjectLabel = (settings: LabSettings) => {
    if (settings.longLabel) return { label: LONG_LABEL, unit: LONG_UNIT }
    return {
        label:
            settings.optionSet === 'none'
                ? LABELS[settings.valueType]
                : 'Anaemia severity',
        unit: NUMERIC.get(settings.valueType)?.unit,
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
    settings: LabSettings,
    domain: Domain,
    random: () => number
) => {
    const count = settings.readings
    const mid = (domain.min + domain.max) / 2
    const range = domain.max - domain.min
    return Array.from({ length: count }, (_, index) => {
        const t = count <= 1 ? 1 : index / (count - 1)
        switch (settings.spread) {
            case 'flat':
                return round(mid, domain.decimals)
            case 'crossing': {
                // Climbs through every band to land exactly on the top band's start, which belongs to that band.
                const top = domain.bands.at(-2) ?? domain.max
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

/** Readings' values as the tracker API sends them, oldest first. */
const subjectValues = (
    settings: LabSettings,
    dates: string[],
    random: () => number
): Array<string | undefined> => {
    const domain = NUMERIC.get(settings.valueType)
    if (settings.optionSet !== 'none') {
        let code = 1
        return dates.map((_, index) => {
            code = Math.min(4, Math.max(1, code + Math.round(random() * 2 - 1)))
            // Ends on Moderate, so the latest shows a style colour.
            return index === dates.length - 1 ? '3' : String(code)
        })
    }
    if (domain) return numericValues(settings, domain, random).map(String)
    return dates.map((date, index) => {
        const last = index === dates.length - 1
        switch (settings.valueType) {
            case 'BOOLEAN':
                return last || random() < 0.3 ? 'true' : 'false'
            case 'TRUE_ONLY':
                // An unticked TRUE_ONLY box sends no value at all.
                return last && settings.trueOnlyUntick ? undefined : 'true'
            case 'DATE':
                return addDays(date, -20 - Math.floor(random() * 20))
            case 'COORDINATE':
                return '[-13.234,8.484]'
            default:
                return NOTES[index % NOTES.length]
        }
    })
}

/** Days between readings, oldest first; jumpy data visits irregularly. */
const gaps = (settings: LabSettings, random: () => number) =>
    Array.from({ length: settings.readings }, () =>
        settings.spread === 'jumpy'
            ? 3 + Math.floor(random() * 60)
            : 12 + Math.floor(random() * 5)
    )

const dataElementJson = (settings: LabSettings) => {
    const domain = NUMERIC.get(settings.valueType)
    const { label } = subjectLabel(settings)
    return {
        id: SUBJECT,
        displayName: LABELS[settings.valueType],
        displayFormName: label,
        valueType: settings.valueType,
        legendSets:
            settings.legendSet && domain
                ? [
                      {
                          legends: domain.names.map((name, index) => ({
                              name,
                              color: BAND_COLOURS[
                                  BAND_COLOURS.length -
                                      domain.names.length +
                                      index
                              ],
                              startValue: domain.bands[index],
                              endValue: domain.bands[index + 1],
                          })),
                      },
                  ]
                : [],
        optionSet:
            settings.optionSet === 'none'
                ? undefined
                : {
                      options: OPTIONS.map(([code, name, color]) => ({
                          code,
                          name,
                          style:
                              settings.optionSet === 'coloured'
                                  ? { color }
                                  : {},
                      })),
                  },
    }
}

const programJson = (settings: LabSettings) => ({
    id: LAB_PROGRAM,
    programStages: [
        {
            id: VISIT_STAGE,
            displayName: 'Antenatal visit',
            access: { data: { read: true } },
            programStageDataElements: [
                { dataElement: dataElementJson(settings) },
                {
                    dataElement: {
                        id: WEIGHT,
                        displayName: 'Weight',
                        valueType: 'NUMBER',
                        legendSets: [],
                    },
                },
                {
                    dataElement: {
                        id: SMOKER,
                        displayName: 'Smokes tobacco',
                        valueType: 'BOOLEAN',
                        legendSets: [],
                    },
                },
            ],
        },
        {
            id: REVIEW_STAGE,
            displayName: 'Specialist review',
            access: { data: { read: !settings.unreadableStage } },
            programStageDataElements: [
                { dataElement: dataElementJson(settings) },
            ],
        },
    ],
})

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
    const readings = Math.max(0, Math.min(500, Math.round(settings.readings)))
    const enrollmentCount = Math.max(1, Math.min(3, settings.enrollments))
    const sized = { ...settings, readings }
    const steps = gaps(sized, random)
    const dates: string[] = []
    let offset = -settings.daysSinceLast
    for (let index = readings - 1; index >= 0; index--) {
        dates.unshift(addDays(today, offset))
        offset -= steps[index] ?? 14
    }
    const values = subjectValues(sized, dates, random)
    const enrollments = Array.from({ length: enrollmentCount }, (_, index) => ({
        enrollment: uid('labEnrol', index + 1),
        trackedEntity: LAB_PERSON,
        program: LAB_PROGRAM,
        status: index === enrollmentCount - 1 ? 'ACTIVE' : 'COMPLETED',
        enrolledAt: `${dates[Math.floor((index * readings) / enrollmentCount)] ?? today}T00:00:00.000`,
    }))
    const enrollmentOf = (index: number) =>
        enrollments[
            Math.floor((index * enrollmentCount) / Math.max(1, readings))
        ]?.enrollment ?? enrollments[0].enrollment
    const event = (
        index: number,
        fields: Pick<LabEvent, 'programStage' | 'status' | 'dataValues'> & {
            date: string
        }
    ): LabEvent => ({
        event: uid('labEvent', index),
        trackedEntity: LAB_PERSON,
        enrollment: enrollmentOf(Math.min(index, readings - 1)),
        program: LAB_PROGRAM,
        programStage: fields.programStage,
        status: fields.status,
        occurredAt: `${fields.date}T09:00:00.000`,
        createdAt: `${fields.date}T09:30:00.000`,
        orgUnit: 'labOrgUnit1',
        dataValues: fields.dataValues,
    })

    const events = dates.map((date, index) => {
        // Every fourth visit is a specialist review, which captures only the subject.
        const review = index % 4 === 3
        const value = values[index]
        return event(index, {
            date,
            programStage: review ? REVIEW_STAGE : VISIT_STAGE,
            status: index === readings - 1 ? 'ACTIVE' : 'COMPLETED',
            dataValues: [
                ...(value === undefined
                    ? []
                    : [{ dataElement: SUBJECT, value }]),
                ...(review
                    ? []
                    : [
                          {
                              dataElement: WEIGHT,
                              value: String(round(62 + random() * 4, 1)),
                          },
                          {
                              dataElement: SMOKER,
                              // The jumpy person took up smoking halfway, so one preset shows Yes.
                              value:
                                  random() < 0.2 ||
                                  (settings.spread === 'jumpy' &&
                                      index >= readings / 2)
                                      ? 'true'
                                      : 'false',
                          },
                      ]),
            ],
        })
    })
    if (settings.scheduledSkipped) {
        // Values that would stand out if a SCHEDULE or SKIPPED event were counted.
        const outlier = NUMERIC.get(settings.valueType)
            ? '999'
            : 'MUST NOT SHOW'
        const extra = dates.flatMap((date, index) =>
            index % 5 === 2
                ? [
                      event(readings + index, {
                          date: addDays(date, 2),
                          programStage: VISIT_STAGE,
                          status: 'SKIPPED',
                          dataValues: [
                              { dataElement: SUBJECT, value: outlier },
                              { dataElement: WEIGHT, value: '999' },
                          ],
                      }),
                  ]
                : []
        )
        extra.push(
            event(readings * 2, {
                date: addDays(today, 14),
                programStage: VISIT_STAGE,
                status: 'SCHEDULE',
                dataValues: [
                    { dataElement: SUBJECT, value: outlier },
                    { dataElement: WEIGHT, value: '999' },
                ],
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
