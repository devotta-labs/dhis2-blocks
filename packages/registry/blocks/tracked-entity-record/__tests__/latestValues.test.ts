import { buildRecord } from '../buildRecord'
import { latestValues } from '../latestValues'
import { event } from './builders'
import { loadFixtures, PRG_OPEN, sourcesFor } from './loadFixtures'

describe('latestValues', () => {
    it('newest ACTIVE or COMPLETED event with a value wins', () => {
        const older = event('older', {
            status: 'COMPLETED',
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { de: '1' },
        })
        const newer = event('newer', {
            status: 'ACTIVE',
            occurredAt: '2025-02-01T00:00:00.000',
            dataValues: { de: '2' },
        })
        // input order must not matter
        expect(latestValues([older, newer]).get('de')?.value).toBe('2')
        expect(latestValues([newer, older]).get('de')?.value).toBe('2')
    })

    it('skips SCHEDULE, SKIPPED and OVERDUE events', () => {
        const kept = event('kept', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { de: 'kept' },
        })
        const others = ['SCHEDULE', 'SKIPPED', 'OVERDUE'].map((status) =>
            event(status, {
                status,
                occurredAt: '2026-01-01T00:00:00.000',
                dataValues: { de: status },
            })
        )
        expect(latestValues([...others, kept]).get('de')?.value).toBe('kept')
    })

    it('skips empty values', () => {
        const older = event('older', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { de: 'old' },
        })
        const newer = event('newer', {
            occurredAt: '2025-02-01T00:00:00.000',
            dataValues: { de: '' },
        })
        expect(latestValues([newer, older]).get('de')?.value).toBe('old')
    })

    it('ties on occurredAt go to the newer createdAt', () => {
        const first = event('first', {
            occurredAt: '2025-01-01T00:00:00.000',
            createdAt: '2025-01-01T10:00:00.000',
            dataValues: { de: 'first' },
        })
        const second = event('second', {
            occurredAt: '2025-01-01T00:00:00.000',
            createdAt: '2025-01-01T11:00:00.000',
            dataValues: { de: 'second' },
        })
        expect(latestValues([first, second]).get('de')?.value).toBe('second')
        expect(latestValues([second, first]).get('de')?.value).toBe('second')
    })

    it('limits to the requested data elements', () => {
        const only = event('e', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { a: '1', b: '2', c: '3' },
        })
        const result = latestValues([only], ['a', 'c'])
        expect([...result.keys()].sort()).toEqual(['a', 'c'])
    })

    it('returns every data element when none are requested', () => {
        const only = event('e', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { a: '1', b: '2' },
        })
        expect([...latestValues([only]).keys()].sort()).toEqual(['a', 'b'])
    })

    it('returns the event the value came from', () => {
        const a = event('a', {
            occurredAt: '2025-02-01T00:00:00.000',
            dataValues: { x: '1' },
        })
        const b = event('b', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { x: '0', y: '9' },
        })
        const result = latestValues([a, b])
        expect(result.get('x')?.event).toBe(a)
        expect(result.get('y')?.event).toBe(b)
    })

    it('an event without occurredAt is older than one with it', () => {
        const dated = event('dated', {
            occurredAt: '2025-01-01T00:00:00.000',
            dataValues: { de: 'dated' },
        })
        const undated = event('undated', { dataValues: { de: 'undated' } })
        expect(latestValues([undated, dated]).get('de')?.value).toBe('dated')
    })

    it('does not change the list it is given', () => {
        const events = [
            event('a', { occurredAt: '2025-01-01T00:00:00.000' }),
            event('b', { occurredAt: '2025-02-01T00:00:00.000' }),
        ]
        latestValues(events)
        expect(events.map(({ event: id }) => id)).toEqual(['a', 'b'])
    })

    it('P1: the empty TrE2eDe0001 value falls through to the older event', () => {
        const built = buildRecord(sourcesFor(loadFixtures('v42'), 'P1'))
        const program = built.programs.get(PRG_OPEN)
        if (program?.status !== 'enrolled') throw new Error('not enrolled')
        const events = program.enrollments.flatMap(({ events: list }) => list)
        const result = latestValues(events)
        // TrE2eEvt003 (2025-09-10) has no TrE2eDe0001; TrE2eEvt002 (2025-07-15) has 37.8.
        expect(result.get('TrE2eDe0001')?.value).toBe('37.8')
        expect(result.get('TrE2eDe0001')?.event.event).toBe('TrE2eEvt002')
        expect(result.get('TrE2eDe0002')?.value).toBe('MILD')
    })
})
