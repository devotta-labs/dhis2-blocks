import type { TimelineEntry } from '@/components/timeline'
import {
    changeEntries,
    eventEntry,
    milestoneEntries,
    noteEntries,
    type ChangeSave,
    type Enrollment,
    type HistoryEntryData,
    type Note,
    type ProgramInfo,
    type ResolvedChange,
    type StageInfo,
    type TrackerEvent,
} from '@/components/timeline-dhis2'

/** What the fake person's history holds. Everything is made up, seeded so a config always gives the same history. */
export interface DataConfig {
    seed: number
    programs: number
    past: number
    upcoming: number
    overdue: number
    skipped: number
    /** Data elements per stage flagged to show on the timeline. */
    values: number
    eventNotes: 'none' | 'one' | 'several'
    enrollment: 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'none'
    enrollmentNotes: number
    attributeChanges: number
    /** Events stored at midnight, as a date only. */
    dateOnly: boolean
    undated: boolean
    /** The program metadata failed: no stage, program or value names. */
    noMetadata: boolean
    longText: boolean
    /** What "Show changes" gets back. */
    changes:
        | 'edited'
        | 'none'
        | 'slow'
        | 'loading'
        | 'error'
        | 'unsupported'
        | 'truncated'
}

export const DEFAULT_DATA: DataConfig = {
    seed: 1,
    programs: 1,
    past: 8,
    upcoming: 2,
    overdue: 1,
    skipped: 1,
    values: 3,
    eventNotes: 'one',
    enrollment: 'ACTIVE',
    enrollmentNotes: 2,
    attributeChanges: 3,
    dateOnly: false,
    undated: false,
    noMetadata: false,
    longText: false,
    changes: 'edited',
}

const DAY = 86_400_000

// mulberry32: a small seeded generator, so a seed gives the same person every time.
const random = (seed: number) => {
    let state = seed >>> 0
    return () => {
        state = (state + 0x6d2b79f5) >>> 0
        let t = state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296
    }
}

export const pad = (value: number) => String(value).padStart(2, '0')

/** As DHIS2 stores it: local, no zone. */
const stored = (date: Date) =>
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00.000`

const storedDate = (date: Date) => `${stored(date).slice(0, 10)}T00:00:00.000`

export const USERS = [
    ['amina', 'Amina Bello'],
    ['kofi', 'Kofi Mensah'],
    ['admin', 'John Traore'],
    ['lena', 'Lena Haugen'],
].map(([username = '', displayName = '']) => ({
    uid: undefined,
    username,
    // Changelog rows name their user from these, as DHIS2 sends them.
    firstName: displayName.split(' ')[0],
    surname: displayName.split(' ')[1],
    displayName,
}))

// The tracker types spell out every optional field.
const BLANK = {
    orgUnit: undefined,
    occurredAt: undefined,
    completedAt: undefined,
    completedBy: undefined,
    createdAt: undefined,
    updatedAt: undefined,
    createdBy: undefined,
    updatedBy: undefined,
}

const ORG_UNITS = [
    ['DiszpKrYNg8', 'Ngelehun CHC'],
    ['g8upMTyEZGZ', 'Njandama MCHP'],
    ['ImspTQPwCqd', 'Bo Government Hospital'],
    [
        'LONGorgUnit',
        'Ngelehun Community Health Centre Maternal and Child Health Post, Badjia Chiefdom',
    ],
] as const

const NOTES = [
    'Mother reports good feeding. Advised to return in two weeks.',
    'Referred for a follow-up with the nurse.',
    'Called, no answer.',
    'Vaccination card was not brought; dates taken from the register.',
]

const LONG_NOTE =
    'Mother came in with the baby two days late because the road from the village was flooded after the rains. The baby has gained weight since the last visit, feeds well and has no fever. Counselled on exclusive breastfeeding and on the danger signs to look for, and agreed on the date of the next visit with her.'

type FieldSpec = [
    id: string,
    name: string,
    valueType: string,
    options?: string[],
]

const FIELDS: FieldSpec[] = [
    ['deWeight', 'Weight (g)', 'NUMBER'],
    [
        'deFeeding',
        'Infant feeding',
        'TEXT',
        ['Exclusive', 'Mixed', 'Replacement'],
    ],
    ['deBcg', 'BCG dose given', 'BOOLEAN'],
    ['deNext', 'Next visit', 'DATE'],
    ['deHb', 'Hemoglobin', 'NUMBER'],
    ['deReferred', 'Referred to', 'ORGANISATION_UNIT'],
    ['deFever', 'Fever', 'TRUE_ONLY'],
    ['deCoverage', 'Coverage', 'PERCENTAGE'],
    ['deComment', 'Clinical notes', 'LONG_TEXT'],
    ['deTemp', 'Temperature (°C)', 'NUMBER'],
]

const PROGRAMS = [
    {
        id: 'labChild001',
        name: 'Child Programme',
        enrollmentDateLabel: 'Date of enrollment',
        incidentDateLabel: 'Date of birth',
        stages: ['Birth', 'Baby postnatal', 'Immunisation'],
    },
    {
        id: 'labAnc00001',
        name: 'Antenatal care',
        enrollmentDateLabel: 'Registration date',
        incidentDateLabel: 'Last menstrual period',
        stages: ['ANC 1st visit', 'ANC follow-up'],
    },
    {
        id: 'labMalaria1',
        name: 'Malaria case diagnosis, treatment and investigation',
        stages: ['Diagnosis and treatment'],
    },
]

const ATTRIBUTES: Array<[string, (pick: <T>(items: T[]) => T) => string]> = [
    ['First name', (pick) => pick(['Fatima', 'Aminata', 'Mariama', 'Isata'])],
    ['Last name', (pick) => pick(['Kamara', 'Sesay', 'Bangura', 'Conteh'])],
    ['Phone number', (pick) => pick(['+232 76 123456', '+232 77 654321'])],
    ['Village', (pick) => pick(['Gbo', 'Ngelehun', 'Baoma'])],
]

const programInfo = (
    spec: (typeof PROGRAMS)[number],
    { values, longText }: DataConfig
): ProgramInfo => ({
    id: spec.id,
    name: spec.name,
    enrollmentDateLabel: spec.enrollmentDateLabel,
    incidentDateLabel: spec.incidentDateLabel,
    attributes: new Map(),
    stages: new Map(
        spec.stages.map((name, index): [string, StageInfo] => {
            const id = `${spec.id}-s${index}`
            return [
                id,
                {
                    id,
                    name: longText
                        ? `${name}: assessment, counselling and follow-up`
                        : name,
                    hideDueDate: false,
                    reportDataElementIds: FIELDS.slice(0, values).map(
                        ([field]) => field
                    ),
                    dataElements: new Map(
                        FIELDS.map(([field, label, valueType, options]) => [
                            field,
                            {
                                name: label,
                                meta: {
                                    valueType,
                                    optionSet: options && {
                                        options: options.map((option) => ({
                                            code: option.toUpperCase(),
                                            displayName: option,
                                        })),
                                    },
                                },
                            },
                        ])
                    ),
                },
            ]
        })
    ),
})

export interface FakeHistory {
    events: TrackerEvent[]
    enrollments: Enrollment[]
    saves: ChangeSave[]
    programs: ProgramInfo[]
    orgUnitNames: ReadonlyMap<string, string>
}

/** A person's history around `base` (the real today, at noon), from `config`. */
export const fakeHistory = (config: DataConfig, base: Date): FakeHistory => {
    const next = random(config.seed)
    const pick = <T>(items: T[]): T =>
        // SAFETY: the index is below items.length, and every list picked from here is non-empty.
        items[Math.floor(next() * items.length)] as T
    const user = () => pick(USERS)
    const orgUnit = () =>
        config.longText ? ORG_UNITS[3][0] : pick(ORG_UNITS.slice(0, 3))[0]
    const daysAgo = (days: number, minutes = 0) =>
        new Date(base.getTime() - days * DAY + minutes * 60_000)
    const noteText = () => (config.longText ? LONG_NOTE : pick(NOTES))
    let ids = 0
    const id = (prefix: string) => `${prefix}${String(++ids).padStart(4, '0')}`
    const note = (at: Date): Note => {
        const by = user()
        return {
            note: id('labNote'),
            value: noteText(),
            storedAt: stored(at),
            storedBy: by.username,
            createdBy: by,
        }
    }

    const specs = PROGRAMS.slice(0, Math.max(1, config.programs))
    const programs = specs.map((spec) => programInfo(spec, config))
    const value = ([field, , valueType, options]: FieldSpec, at: Date) => {
        if (options) {
            return pick(options).toUpperCase()
        }
        switch (valueType) {
            case 'BOOLEAN':
                return pick(['true', 'false'])
            case 'TRUE_ONLY':
                return 'true'
            case 'DATE':
                return stored(new Date(at.getTime() + 14 * DAY)).slice(0, 10)
            case 'ORGANISATION_UNIT':
                return orgUnit()
            case 'PERCENTAGE':
                return String(Math.round(next() * 100))
            case 'LONG_TEXT':
                return noteText()
            default:
                return field === 'deWeight'
                    ? String(2500 + Math.round(next() * 2000))
                    : (8 + next() * 30).toFixed(1)
        }
    }

    // Spread over the programs in turn, newest first.
    const events: TrackerEvent[] = []
    const event = (
        index: number,
        fields: Partial<TrackerEvent> & Pick<TrackerEvent, 'status'>
    ): TrackerEvent => {
        // SAFETY: there is always at least one program, and the index wraps within them.
        const program = programs[index % programs.length] as ProgramInfo
        const stage = pick([...program.stages.keys()])
        return {
            ...BLANK,
            trackedEntity: undefined,
            scheduledAt: undefined,
            event: id('labEvt'),
            program: program.id,
            programStage: stage,
            enrollment: `${program.id}-enr`,
            orgUnit: orgUnit(),
            createdBy: user(),
            dataValues: [],
            notes: [],
            ...fields,
        }
    }

    for (let index = 0; index < config.past; index++) {
        const occurred = daysAgo(
            index * 9 + Math.floor(next() * 6),
            -Math.floor(next() * 480)
        )
        const completed = next() < 0.8 || index > 2
        const edited = next() < 0.6
        const noteCount = { none: 0, one: 1, several: 3 }[config.eventNotes]
        events.push(
            event(index, {
                status: completed ? 'COMPLETED' : 'ACTIVE',
                occurredAt: config.dateOnly
                    ? storedDate(occurred)
                    : stored(occurred),
                createdAt: stored(occurred),
                updatedAt: stored(
                    edited ? new Date(occurred.getTime() + DAY) : occurred
                ),
                ...(completed && {
                    completedAt: stored(occurred),
                    completedBy: user().username,
                }),
                dataValues: FIELDS.filter(() => next() < 0.85).map((field) => ({
                    dataElement: field[0],
                    value: value(field, occurred),
                })),
                notes: Array.from({ length: noteCount }, (_, at) =>
                    note(new Date(occurred.getTime() + at * 3 * DAY))
                ),
            })
        )
    }
    const scheduled = (index: number, at: Date, status: string) => {
        const created = stored(daysAgo(30))
        events.push(
            event(index, {
                status,
                scheduledAt: storedDate(at),
                createdAt: created,
                updatedAt: created,
            })
        )
    }
    for (let index = 0; index < config.upcoming; index++) {
        scheduled(index, daysAgo(-(index + 1) * 14), 'SCHEDULE')
    }
    for (let index = 0; index < config.overdue; index++) {
        scheduled(index, daysAgo(index * 5 + 2), 'SCHEDULE')
    }
    for (let index = 0; index < config.skipped; index++) {
        scheduled(index, daysAgo(index * 11 + 20), 'SKIPPED')
    }
    if (config.undated) {
        events.push(event(0, { status: 'ACTIVE' }))
    }

    const oldest = config.past * 9 + 14
    const enrollments: Enrollment[] =
        config.enrollment === 'none'
            ? []
            : programs.map((program, index) => ({
                  ...BLANK,
                  enrollment: `${program.id}-enr`,
                  program: program.id,
                  status: config.enrollment,
                  orgUnit: orgUnit(),
                  enrolledAt: storedDate(daysAgo(oldest + index)),
                  occurredAt: storedDate(daysAgo(oldest + index + 40)),
                  updatedAt: stored(daysAgo(1, -60)),
                  ...(config.enrollment === 'COMPLETED' && {
                      completedAt: stored(daysAgo(1, -60)),
                      completedBy: user().username,
                  }),
                  notes: Array.from({ length: config.enrollmentNotes }, () =>
                      note(daysAgo(Math.floor(next() * oldest), 90))
                  ),
              }))

    const saves: ChangeSave[] = Array.from(
        { length: config.attributeChanges },
        (_, index) => {
            const by = user()
            const createdAt = stored(daysAgo(index * 13 + 3, 45))
            const first = index === config.attributeChanges - 1
            const changes = ATTRIBUTES.filter(() => first || next() < 0.4).map(
                ([name, make]): ResolvedChange => {
                    const type = first
                        ? 'CREATE'
                        : pick(['UPDATE', 'UPDATE', 'DELETE'] as const)
                    const current = make(pick)
                    // Every attribute has two or more values, so this ends.
                    let previous = make(pick)
                    while (previous === current) {
                        previous = make(pick)
                    }
                    return {
                        field: { kind: 'attribute', id: name },
                        name,
                        meta: { valueType: 'TEXT' },
                        type,
                        ...(type !== 'CREATE' && { previousValue: previous }),
                        ...(type !== 'DELETE' && { currentValue: current }),
                    }
                }
            )
            return {
                id: `${createdAt}:${by.username}`,
                createdAt,
                user: by,
                changes:
                    changes.length > 0
                        ? changes
                        : [
                              {
                                  field: {
                                      kind: 'attribute',
                                      id: 'Phone number',
                                  },
                                  name: 'Phone number',
                                  meta: { valueType: 'TEXT' },
                                  type: 'UPDATE',
                                  previousValue: '+232 76 123456',
                                  currentValue: '+232 77 654321',
                              },
                          ],
            }
        }
    )

    return {
        events,
        enrollments,
        saves,
        programs,
        orgUnitNames: new Map(ORG_UNITS),
    }
}

/** The history as the hooks would hand it to the timeline, for the viewer's `today`. */
export const historyEntries = (
    history: FakeHistory,
    { today, noMetadata }: { today: string; noMetadata: boolean }
): TimelineEntry<HistoryEntryData>[] => {
    const programOf = (id?: string) =>
        noMetadata
            ? undefined
            : history.programs.find((program) => program.id === id)
    return [
        ...history.events.map((event) =>
            eventEntry(event, {
                timeField: 'occurredAt',
                today,
                program: programOf(event.program),
                orgUnitNames: history.orgUnitNames,
            })
        ),
        ...history.enrollments.flatMap((enrollment) => [
            ...milestoneEntries(enrollment, programOf(enrollment.program)),
            ...noteEntries(enrollment, programOf(enrollment.program)),
        ]),
        ...changeEntries(history.saves),
    ]
}
