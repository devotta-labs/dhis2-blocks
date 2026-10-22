import { readFileSync } from 'node:fs'
import { toEventEntry } from './toEventEntry'
import {
    EventsPageSchema,
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
                new URL(`./__fixtures__/ugly/${name}`, import.meta.url),
                'utf8'
            )
        )
    )

const options = { sourceKey: 'events', today } as const

describe('toEventEntry', () => {
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
            id: 'events:e1',
            at: '2026-05-03T10:15:00.000',
            precision: 'instant',
            phase: 'past',
            sourceKey: 'events',
            data: { event: completed, status: 'completed' },
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
                sourceKey: 'events',
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
