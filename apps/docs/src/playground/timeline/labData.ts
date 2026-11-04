import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import type { EventTimeField } from '@/components/timeline/dhis2'
import type { LabNetwork } from '../network'
import {
    ADDRESS,
    BIRTH_DATE,
    CLERK,
    FIRST_NAME,
    NCD_NUMBER,
    NGELEHUN,
    NURSE,
    ORG_UNITS,
    PHONE,
    PROGRAMS,
    programJson,
    SURNAME,
    type ProgramSpec,
    type StageSpec,
    type User,
} from './programs'

export { LAB_PROGRAMS, ORG_UNITS } from './programs'

export const LAB_PERSON = 'labPerson01'
const PERSON_TYPE = 'labTetPersn'

type LabLocale = 'en' | 'fr' | 'ar'

export interface LabSettings {
    /** Programs the person is enrolled in (0–3), in `LAB_PROGRAMS` order. */
    programs: number
    /** Past events (completed, and the newest active) in each program. */
    events: [number, number, number]
    /** Scheduled visits after today, in each program. */
    upcoming: number
    /** Scheduled visits whose due day has passed, in each program. */
    overdue: number
    /** Skipped visits, in each program. */
    skipped: number
    /** Notes on enrollments and on every fourth event. */
    notes: boolean
    /** What the changelog endpoints answer. */
    changelog: 'some' | 'many' | 'none' | 'unsupported'
    /** A part of the history whose requests fail with a 500. */
    failing: 'none' | 'changes' | 'metadata' | 'orgUnits' | 'events'
    timeField: EventTimeField
    calendar: Dhis2Calendar
    locale: LabLocale
    /** `useShowMore`'s step: past entries shown, then revealed, at a time. */
    step: number
    network: LabNetwork
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

const addDays = (day: string, offset: number) => {
    const date = new Date(`${day}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + offset)
    return date.toISOString().slice(0, 10)
}

const isoToday = () => new Date().toLocaleDateString('sv')

const uid = (prefix: string, index: number) =>
    `${prefix}${String(index).padStart(11 - prefix.length, '0')}`

/** A stored date-time, as the tracker API writes it. */
const at = (day: string, time = '00:00') => `${day}T${time}:00.000`

const clock = (random: () => number, from = 8, to = 16) => {
    const minutes = Math.floor(random() * (to - from) * 60)
    const hours = String(from + Math.floor(minutes / 60)).padStart(2, '0')
    return `${hours}:${String(minutes % 60).padStart(2, '0')}`
}

const PAST_NOTES = [
    'Counselled on nutrition and iron supplements.',
    'Asked to come back with her partner.',
    'Transport money given for the next visit.',
]

interface LabNote {
    note: string
    value: string
    storedAt: string
    storedBy: string
    createdBy: User & { displayName: string }
}

export interface LabEvent {
    event: string
    status: string
    program: string
    programStage: string
    enrollment: string
    trackedEntity: string
    orgUnit: string
    occurredAt?: string
    scheduledAt: string
    completedAt?: string
    completedBy?: string
    createdAt: string
    updatedAt: string
    createdBy: User
    updatedBy: User
    dataValues: Array<{ dataElement: string; value: string }>
    notes: LabNote[]
}

interface LabEnrollment {
    enrollment: string
    program: string
    status: string
    orgUnit: string
    enrolledAt: string
    occurredAt: string
    completedAt?: string
    completedBy?: string
    createdAt: string
    updatedAt: string
    createdBy: User
    updatedBy: User
    notes: LabNote[]
}

export interface LabChangeLogRow {
    createdAt: string
    createdBy: User
    type: 'CREATE' | 'UPDATE' | 'DELETE'
    change:
        | {
              attributeValue: {
                  attribute: string
                  previousValue?: string
                  currentValue?: string
              }
          }
        | {
              dataValue: {
                  dataElement: string
                  previousValue?: string
                  currentValue?: string
              }
          }
        | {
              eventField: {
                  field: string
                  previousValue?: string
                  currentValue?: string
              }
          }
}

const noteBy = (
    id: string,
    value: string,
    storedAt: string,
    user = NURSE
): LabNote => ({
    note: id,
    value,
    storedAt,
    storedBy: user.username,
    createdBy: { ...user, displayName: `${user.firstName} ${user.surname}` },
})
/** The stage of a visit: the program's first or closing stage where it has one, else its repeatable one. */
const stageOf = (
    spec: ProgramSpec,
    { first, closing }: { first: boolean; closing: boolean }
): StageSpec => {
    if (first && spec.first) return spec.first
    if (closing && spec.closing) return spec.closing
    return spec.repeat
}

const gapFor = (count: number) =>
    Math.max(2, Math.min(21, Math.floor(1500 / Math.max(1, count))))

const stored = (day: string) => `${day} 00:00:00.000`

interface ProgramData {
    enrollments: LabEnrollment[]
    events: LabEvent[]
    /** Each edited or recorded event's changelog, newest first. */
    eventChanges: Map<string, LabChangeLogRow[]>
}

/** One program's enrollments and events, oldest first, ending `lastDaysAgo` days before today. */
const programData = (
    spec: ProgramSpec,
    position: number,
    settings: LabSettings,
    today: string
): ProgramData => {
    const random = seeded(20261104 + 7919 * (position + 1))
    const count = Math.max(0, Math.round(settings.events[position] ?? 0))
    const gap = gapFor(count)
    const lastDaysAgo = 3 + position * 5
    // A long antenatal history is two pregnancies: the first enrollment closed with a delivery, a year and more before the second.
    const split = position === 0 && count >= 4 ? Math.floor(count / 2) : 0
    const days: string[] = []
    for (let index = 0; index < count; index++) {
        const jitter = Math.floor(random() * Math.min(5, gap))
        const between = split > 0 && index >= count - split ? 400 : 0
        days.unshift(
            addDays(today, -lastDaysAgo - index * gap - jitter - between)
        )
    }
    const runs = split > 0 ? [days.slice(0, split), days.slice(split)] : [days]
    const enrollments: LabEnrollment[] = []
    const events: LabEvent[] = []
    const eventChanges = new Map<string, LabChangeLogRow[]>()
    let next = 0
    const eventId = () => uid(`lbE${position + 1}`, ++next)

    runs.forEach((run, runIndex) => {
        const completed = runIndex < runs.length - 1
        const enrolledDay = run[0] ?? addDays(today, -10 - position * 4)
        const enrollmentId = uid(`lbEnr${position + 1}`, runIndex + 1)
        const lastDay = run.at(-1) ?? enrolledDay
        const closedAt = completed
            ? at(addDays(lastDay, 1), '15:10')
            : undefined
        enrollments.push({
            enrollment: enrollmentId,
            program: spec.id,
            status: completed ? 'COMPLETED' : 'ACTIVE',
            orgUnit: NGELEHUN,
            enrolledAt: at(enrolledDay),
            occurredAt: at(addDays(enrolledDay, -(spec.incidentBefore ?? 0))),
            completedAt: closedAt,
            completedBy: closedAt && NURSE.username,
            createdAt: at(enrolledDay, '08:40'),
            updatedAt: closedAt ?? at(enrolledDay, '08:40'),
            createdBy: CLERK,
            updatedBy: completed ? NURSE : CLERK,
            notes: settings.notes
                ? [
                      noteBy(
                          uid(`lbNtE${position + 1}`, runIndex + 1),
                          completed
                              ? 'Pregnancy closed after delivery.'
                              : spec.enrollmentNote,
                          at(enrolledDay, '08:55'),
                          CLERK
                      ),
                  ]
                : [],
        })

        run.forEach((day, index) => {
            const last = index === run.length - 1
            const stage = stageOf(spec, {
                first: index === 0,
                closing: last && completed,
            })
            const visit = { index, day, random }
            const dataValues = stage.elements.flatMap((element) => {
                const value = element.value(visit)
                return value === undefined
                    ? []
                    : [{ dataElement: element.id, value }]
            })
            const recorded = at(day, clock(random, 9, 12))
            // Every fifth visit was corrected a few days later.
            const edited = index % 5 === 1 && dataValues.length > 0
            const updated = edited
                ? at(addDays(day, 2), clock(random, 13, 17))
                : recorded
            // The newest visit in the open enrollment is still being filled in.
            const active = !completed && last
            const id = eventId()
            const scheduledDay = addDays(day, -1 - Math.floor(random() * 3))
            const event: LabEvent = {
                event: id,
                status: active ? 'ACTIVE' : 'COMPLETED',
                program: spec.id,
                programStage: stage.id,
                enrollment: enrollmentId,
                trackedEntity: LAB_PERSON,
                orgUnit: spec.orgUnitOf(index),
                occurredAt: at(day),
                scheduledAt: at(scheduledDay),
                completedAt: active
                    ? undefined
                    : at(day, clock(random, 12, 16)),
                completedBy: active ? undefined : NURSE.username,
                createdAt: recorded,
                updatedAt: updated,
                createdBy: NURSE,
                updatedBy: NURSE,
                dataValues,
                notes:
                    settings.notes && index % 4 === 3
                        ? [
                              noteBy(
                                  uid(`lbNt${position + 1}`, next),
                                  PAST_NOTES[index % PAST_NOTES.length] ?? '',
                                  recorded
                              ),
                          ]
                        : [],
            }
            const rows: LabChangeLogRow[] = [
                ...dataValues.map(
                    ({ dataElement, value }): LabChangeLogRow => ({
                        createdAt: recorded,
                        createdBy: NURSE,
                        type: 'CREATE',
                        change: {
                            dataValue: { dataElement, currentValue: value },
                        },
                    })
                ),
                {
                    createdAt: recorded,
                    createdBy: NURSE,
                    type: 'CREATE',
                    change: {
                        eventField: {
                            field: 'occurredAt',
                            currentValue: stored(day),
                        },
                    },
                },
                {
                    createdAt: recorded,
                    createdBy: NURSE,
                    type: 'CREATE',
                    change: {
                        eventField: {
                            field: 'scheduledAt',
                            currentValue: stored(scheduledDay),
                        },
                    },
                },
            ]
            const [first] = dataValues
            if (edited && first) {
                // The value was first typed with a slip, then corrected.
                const typo = `${first.value}0`
                const create = rows[0]
                if (create && 'dataValue' in create.change) {
                    create.change.dataValue.currentValue = typo
                }
                rows.unshift({
                    createdAt: updated,
                    createdBy: NURSE,
                    type: 'UPDATE',
                    change: {
                        dataValue: {
                            dataElement: first.dataElement,
                            previousValue: typo,
                            currentValue: first.value,
                        },
                    },
                })
            }
            eventChanges.set(id, rows)
            events.push(event)
        })
    })

    // Upcoming, overdue and skipped visits belong to the open enrollment, with nothing recorded yet.
    const open = enrollments.at(-1)
    if (open) {
        const planned = (status: string, day: string): LabEvent => {
            const created = at(addDays(today, -20), '10:05')
            return {
                event: eventId(),
                status,
                program: spec.id,
                programStage: spec.repeat.id,
                enrollment: open.enrollment,
                trackedEntity: LAB_PERSON,
                orgUnit: spec.orgUnitOf(0),
                scheduledAt: at(day),
                createdAt: created,
                updatedAt: created,
                createdBy: NURSE,
                updatedBy: NURSE,
                dataValues: [],
                notes: [],
            }
        }
        for (let index = 0; index < settings.upcoming; index++) {
            events.push(
                planned(
                    'SCHEDULE',
                    addDays(today, 12 + position * 3 + index * 28)
                )
            )
        }
        for (let index = 0; index < settings.overdue; index++) {
            events.push(
                planned(
                    'SCHEDULE',
                    addDays(today, -6 - position * 2 - index * 14)
                )
            )
        }
        for (let index = 0; index < settings.skipped; index++) {
            events.push(
                planned(
                    'SKIPPED',
                    addDays(today, -40 - position * 6 - index * 21)
                )
            )
        }
    }
    return { enrollments, events, eventChanges }
}

/** How many saves the "many" changelog adds: past the block's 500 rows, so it pages and says older changes aren't shown. */
const MANY_CHANGES = 540

/** The attribute changelog of one program's answer, newest first. The type's attributes repeat in every program, as DHIS2 does. */
const attributeChanges = (
    settings: LabSettings,
    spec: ProgramSpec,
    registered: string,
    today: string
): LabChangeLogRow[] => {
    if (settings.changelog === 'none' || settings.changelog === 'unsupported')
        return []
    const row = (
        createdAt: string,
        createdBy: User,
        type: LabChangeLogRow['type'],
        attribute: string,
        previousValue?: string,
        currentValue?: string
    ): LabChangeLogRow => ({
        createdAt,
        createdBy,
        type,
        change: {
            attributeValue: {
                attribute,
                previousValue,
                currentValue,
            },
        },
    })
    const registeredAt = at(registered, '08:35')
    const renamedAt = at(addDays(today, -120), '11:20')
    const rows: LabChangeLogRow[] = [
        row(registeredAt, CLERK, 'CREATE', FIRST_NAME, undefined, 'Amina'),
        row(registeredAt, CLERK, 'CREATE', SURNAME, undefined, 'Conteh'),
        row(registeredAt, CLERK, 'CREATE', BIRTH_DATE, undefined, '1994-04-12'),
        row(registeredAt, CLERK, 'CREATE', PHONE, undefined, '+232 76 123 456'),
        // One save that changes two fields.
        row(renamedAt, NURSE, 'UPDATE', FIRST_NAME, 'Amina', 'Aminata'),
        row(
            renamedAt,
            NURSE,
            'UPDATE',
            PHONE,
            '+232 76 123 456',
            '+232 77 654 321'
        ),
    ]
    if (spec.attributes.some(({ id }) => id === ADDRESS)) {
        rows.push(
            row(
                registeredAt,
                CLERK,
                'CREATE',
                ADDRESS,
                undefined,
                '12 Hospital Road'
            ),
            row(
                at(addDays(today, -45), '14:02'),
                NURSE,
                'UPDATE',
                ADDRESS,
                '12 Hospital Road',
                '4 Market Street, Bo'
            )
        )
    }
    if (spec.attributes.some(({ id }) => id === NCD_NUMBER)) {
        rows.push(
            row(
                at(addDays(today, -60), '09:12'),
                CLERK,
                'CREATE',
                NCD_NUMBER,
                undefined,
                'NCD-0412'
            ),
            row(
                at(addDays(today, -8), '10:40'),
                CLERK,
                'DELETE',
                NCD_NUMBER,
                'NCD-0412'
            )
        )
    }
    if (settings.changelog === 'many') {
        let phone = '+232 77 654 321'
        for (let index = 0; index < MANY_CHANGES; index++) {
            const nextPhone = `+232 77 ${String(index).padStart(6, '0')}`
            rows.push(
                row(
                    at(
                        addDays(today, -119 + Math.floor(index / 5)),
                        `1${index % 10}:0${index % 6}`
                    ),
                    CLERK,
                    'UPDATE',
                    PHONE,
                    phone,
                    nextPhone
                )
            )
            phone = nextPhone
        }
    }
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/**
 * Everything the lab's DHIS2 holds for its one person: the programs, their
 * enrollments and events, the changelogs, and the system info app-runtime
 * hands the block.
 */
export const generateLabData = (settings: LabSettings, today = isoToday()) => {
    const specs = PROGRAMS.slice(0, Math.max(0, Math.min(3, settings.programs)))
    const parts = specs.map((spec, position) =>
        programData(spec, position, settings, today)
    )
    const enrollments = parts.flatMap((part) => part.enrollments)
    const registered =
        enrollments
            .map(({ enrolledAt }) => enrolledAt.slice(0, 10))
            .sort()[0] ?? addDays(today, -30)
    return {
        trackedEntity: {
            trackedEntity: LAB_PERSON,
            trackedEntityType: PERSON_TYPE,
            orgUnit: NGELEHUN,
            enrollments,
        },
        /** Every program's metadata, enrolled or not, so `programs` can name one the person left. */
        programs: new Map(PROGRAMS.map((spec) => [spec.id, programJson(spec)])),
        events: parts.flatMap((part) => part.events),
        eventChanges: new Map(parts.flatMap((part) => [...part.eventChanges])),
        attributeChanges: new Map(
            specs.map((spec) => [
                spec.id,
                attributeChanges(settings, spec, registered, today),
            ])
        ),
        orgUnits: ORG_UNITS,
        systemInfo: {
            version: '2.43.0',
            contextPath: '',
            serverTimeZoneId: 'Etc/UTC',
            calendar: settings.calendar,
        },
    }
}

export type LabData = ReturnType<typeof generateLabData>
