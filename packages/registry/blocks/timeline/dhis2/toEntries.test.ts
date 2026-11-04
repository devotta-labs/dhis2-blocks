import { readFileSync } from 'node:fs'
import { toProgramInfo } from './metadata'
import {
    changeEntries,
    eventEntry as toEventEntry,
    milestoneEntries,
    noteEntries,
    orgUnitIdsOf,
} from './toEntries'
import {
    EventsPageSchema,
    ProgramTimelineMetadataSchema,
    TrackedEntitySchema,
    TrackerEventSchema,
    type TrackerEvent,
} from './schemas'

const today = '2026-10-22'

const event = (
    status: string,
    extra: Partial<TrackerEvent> = {}
): TrackerEvent =>
    TrackerEventSchema.parse({
        event: 'e1',
        status,
        programStage: 's1',
        ...extra,
    })

const ugly = (name: string): TrackerEvent[] =>
    EventsPageSchema.parse(
        JSON.parse(
            readFileSync(
                new URL(`./__tests__/fixtures/ugly/${name}`, import.meta.url),
                'utf8'
            )
        )
    )

const options = { today } as const

describe('eventEntry', () => {
    it('places a completed event by the chosen time field', () => {
        const completed = event('COMPLETED', {
            occurredAt: '2026-05-01T08:00:00.000',
            completedAt: '2026-05-03T10:15:00.000',
        })

        const entry = toEventEntry(completed, {
            ...options,
            timeField: 'completedAt',
        })

        expect(entry).toMatchObject({
            id: 'event:e1',
            at: '2026-05-03T10:15:00.000',
            precision: 'instant',
            phase: 'past',
            data: { kind: 'event', event: completed, status: 'completed' },
        })
        expect(
            toEventEntry(completed, { ...options, timeField: 'occurredAt' }).at
        ).toBe('2026-05-01T08:00:00.000')
    })

    it('places scheduled, overdue and skipped events by scheduledAt regardless of timeField', () => {
        const base = { occurredAt: '2026-01-01', createdAt: '2020-01-01' }
        const future = toEventEntry(
            event('SCHEDULE', {
                ...base,
                scheduledAt: '2027-01-15T00:00:00.000',
            }),
            { ...options, timeField: 'occurredAt' }
        )
        const overdue = toEventEntry(
            event('SCHEDULE', {
                ...base,
                scheduledAt: '2026-08-01T00:00:00.000',
            }),
            { ...options, timeField: 'createdAt' }
        )
        const legacy = toEventEntry(
            event('OVERDUE', {
                ...base,
                scheduledAt: '2026-09-01T00:00:00.000',
            }),
            { ...options, timeField: 'createdAt' }
        )
        const skipped = toEventEntry(
            event('SKIPPED', {
                ...base,
                scheduledAt: '2026-04-20T00:00:00.000',
            }),
            { ...options, timeField: 'completedAt' }
        )

        expect(
            [future, overdue, legacy, skipped].map((e) => [e.at, e.phase])
        ).toEqual([
            ['2027-01-15T00:00:00.000', 'future'],
            ['2026-08-01T00:00:00.000', 'overdue'],
            ['2026-09-01T00:00:00.000', 'overdue'],
            ['2026-04-20T00:00:00.000', 'past'],
        ])
        expect(skipped.data.status).toBe('skipped')
    })

    it('puts an event without its time field in Undated', () => {
        const activeEvent = event('ACTIVE', {
            occurredAt: '2026-05-01T00:00:00.000',
        })

        expect(
            toEventEntry(activeEvent, {
                timeField: 'completedAt',
                today,
            }).at
        ).toBe('')
    })

    it('marks a date-only value as day precision', () => {
        const entry = toEventEntry(
            event('COMPLETED', { occurredAt: '2026-05-01' }),
            { ...options, timeField: 'occurredAt' }
        )

        expect(entry.precision).toBe('day')
    })

    it('keeps a back-entered event on its occurredAt, not its createdAt', () => {
        const [backEntered] = ugly('back-entered.json')
        if (!backEntered) throw new Error('fixture is empty')

        const entry = toEventEntry(backEntered, {
            ...options,
            timeField: 'occurredAt',
        })

        expect(entry.at).toBe('2025-01-15T00:00:00.000')
        expect(entry.at).not.toBe(backEntered.createdAt)
    })

    it('places an event whose occurredAt was edited by its current occurredAt', () => {
        const [edited] = ugly('occurred-edited.json')
        if (!edited) throw new Error('fixture is empty')

        expect(
            toEventEntry(edited, { ...options, timeField: 'occurredAt' }).at
        ).toBe('2026-06-12T00:00:00.000')
    })

    it('gives every visit of a repeating stage its own entry', () => {
        const visits = ugly('one-stage-every-visit.json')

        const ids = visits.map(
            (visit) =>
                toEventEntry(visit, { ...options, timeField: 'occurredAt' }).id
        )

        expect(new Set(ids).size).toBe(visits.length)
    })

    it('puts a scheduled or overdue event without scheduledAt in Undated, not in a phase', () => {
        const entries = ['SCHEDULE', 'OVERDUE'].map((status) =>
            toEventEntry(event(status), { ...options, timeField: 'occurredAt' })
        )

        expect(entries.map((e) => [e.at, e.phase])).toEqual([
            ['', 'past'],
            ['', 'past'],
        ])
    })
})

const program = toProgramInfo(
    ProgramTimelineMetadataSchema.parse({
        id: 'p1',
        displayName: 'ANC',
        programStages: [
            {
                id: 's1',
                displayName: 'First visit',
                programStageDataElements: [
                    {
                        displayInReports: true,
                        dataElement: {
                            id: 'clinic',
                            displayName: 'Referred to',
                            valueType: 'ORGANISATION_UNIT',
                        },
                    },
                    {
                        dataElement: {
                            id: 'weight',
                            displayName: 'Weight',
                            valueType: 'NUMBER',
                        },
                    },
                ],
            },
        ],
        programTrackedEntityAttributes: [],
    })
)

describe('eventEntry names', () => {
    it('carries its program, stage and org unit name', () => {
        const names = new Map([['ou1', 'Ngelehun CHC']])

        const entry = toEventEntry(event('ACTIVE', { orgUnit: 'ou1' }), {
            ...options,
            timeField: 'occurredAt',
            program,
            orgUnitNames: names,
        })

        expect(entry.data.program?.name).toBe('ANC')
        expect(entry.data.stage?.name).toBe('First visit')
        expect(entry.data.stage?.reportDataElementIds).toEqual(['clinic'])
        expect(entry.data.orgUnitName).toBe('Ngelehun CHC')
        expect(entry.data.orgUnitNames).toBe(names)
    })

    it('leaves names out when the metadata or the name is missing', () => {
        const entry = toEventEntry(event('ACTIVE', { orgUnit: 'ou1' }), {
            ...options,
            timeField: 'occurredAt',
        })

        expect(entry.data).not.toHaveProperty('program')
        expect(entry.data).not.toHaveProperty('stage')
        expect(entry.data).not.toHaveProperty('orgUnitName')
    })
})

describe('orgUnitIdsOf', () => {
    it("collects each event's org unit and its org-unit-typed values, sorted and unique", () => {
        const events = [
            event('ACTIVE', {
                orgUnit: 'ou2',
                dataValues: [
                    { dataElement: 'clinic', value: 'ou3' },
                    { dataElement: 'weight', value: '60' },
                ],
            }),
            event('ACTIVE', { orgUnit: 'ou2' }),
        ]

        expect(orgUnitIdsOf([{ events, program }])).toEqual(['ou2', 'ou3'])
        // Without metadata the value types are unknown: only org units.
        expect(orgUnitIdsOf([{ events }])).toEqual(['ou2'])
    })
})

describe('enrollment entries', () => {
    const [enrollment] = TrackedEntitySchema.parse({
        trackedEntity: 'te1',
        enrollments: [
            {
                enrollment: 'en1',
                program: 'p1',
                status: 'COMPLETED',
                enrolledAt: '2026-01-10T00:00:00.000',
                occurredAt: '2026-01-10T00:00:00.000',
                completedAt: '2026-03-01T10:15:00.000',
                notes: [
                    {
                        note: 'n1',
                        value: 'Moved',
                        storedAt: '2026-02-01T09:00',
                    },
                    { note: 'n2', value: 'Never stored' },
                ],
            },
        ],
    }).enrollments

    it('makes a milestone per date, skipping an incident on the enrollment day', () => {
        const entries = milestoneEntries(enrollment, program)

        expect(
            entries.map((entry) => [entry.id, entry.precision, entry.data.kind])
        ).toEqual([
            ['milestone:en1:enrolled', 'day', 'milestone'],
            ['milestone:en1:completed', 'instant', 'milestone'],
        ])
        expect(entries[0]?.data.program).toBe(program)
    })

    it('makes a note entry per stored note', () => {
        const entries = noteEntries(enrollment)

        expect(entries.map((entry) => [entry.id, entry.at])).toEqual([
            ['note:n1', '2026-02-01T09:00'],
        ])
        expect(entries[0]?.data).toMatchObject({ kind: 'note', enrollment })
    })

    // The server's clock can be a day ahead of the viewer's: what has
    // happened must not land above "now".
    it('puts notes, changes and closing milestones in the past, stored after today too', () => {
        const [ahead] = TrackedEntitySchema.parse({
            trackedEntity: 'te1',
            enrollments: [
                {
                    enrollment: 'en2',
                    program: 'p1',
                    status: 'CANCELLED',
                    enrolledAt: '2026-01-10T00:00:00.000',
                    occurredAt: '2026-12-01T00:00:00.000',
                    updatedAt: '2026-10-23T01:00:00.000',
                    notes: [
                        {
                            note: 'n3',
                            value: 'Just now',
                            storedAt: '2026-10-23T01:00:00.000',
                        },
                    ],
                },
            ],
        }).enrollments
        if (ahead === undefined) {
            throw new Error('fixture has no enrollment')
        }
        const save = {
            id: 's1',
            createdAt: '2026-10-23T01:00:00.000',
            user: { username: 'u', displayName: 'U' },
            changes: [],
        }

        expect(
            [
                ...milestoneEntries(ahead),
                ...noteEntries(ahead),
                ...changeEntries([save]),
            ].map((entry) => [entry.id, entry.phase])
        ).toEqual([
            ['milestone:en2:enrolled', undefined],
            // A future incident date stays future.
            ['milestone:en2:incident', undefined],
            ['milestone:en2:cancelled', 'past'],
            ['note:n3', 'past'],
            ['change:s1', 'past'],
        ])
    })
})
