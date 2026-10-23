import { eventStatus, isOverdue, todayIso } from '../eventStatus'
import { event } from './builders'

const today = '2026-10-23'

describe('eventStatus', () => {
    it('SCHEDULE due 2026-10-22 is overdue', () => {
        const due = event('e', {
            status: 'SCHEDULE',
            scheduledAt: '2026-10-22T00:00:00.000',
        })
        expect(eventStatus(due, today)).toBe('overdue')
        expect(isOverdue(due, today)).toBe(true)
    })

    it('SCHEDULE due today is scheduled', () => {
        const due = event('e', {
            status: 'SCHEDULE',
            scheduledAt: '2026-10-23T00:00:00.000',
        })
        expect(eventStatus(due, today)).toBe('scheduled')
        expect(isOverdue(due, today)).toBe(false)
    })

    it('SCHEDULE due in the future is scheduled', () => {
        const due = event('e', {
            status: 'SCHEDULE',
            scheduledAt: '2090-06-01T00:00:00.000',
        })
        expect(eventStatus(due, today)).toBe('scheduled')
    })

    it('a SCHEDULE event without scheduledAt is scheduled', () => {
        expect(eventStatus(event('e', { status: 'SCHEDULE' }), today)).toBe(
            'scheduled'
        )
    })

    it('stored OVERDUE is overdue', () => {
        const stored = event('e', { status: 'OVERDUE' })
        expect(eventStatus(stored, today)).toBe('overdue')
        expect(isOverdue(stored, today)).toBe(true)
    })

    it('ACTIVE is active and COMPLETED is completed', () => {
        expect(eventStatus(event('e', { status: 'ACTIVE' }), today)).toBe(
            'active'
        )
        expect(eventStatus(event('e', { status: 'COMPLETED' }), today)).toBe(
            'completed'
        )
    })

    it('SKIPPED is skipped', () => {
        expect(eventStatus(event('e', { status: 'SKIPPED' }), today)).toBe(
            'skipped'
        )
    })

    it('VISITED and an unknown status are active', () => {
        expect(eventStatus(event('e', { status: 'VISITED' }), today)).toBe(
            'active'
        )
        expect(
            eventStatus(event('e', { status: 'SOMETHING_NEW' }), today)
        ).toBe('active')
    })

    it('a scheduledAt with a time and offset compares by its stored day', () => {
        const lateLastNight = event('e', {
            status: 'SCHEDULE',
            scheduledAt: '2026-10-22T23:30:00.000+14:00',
        })
        const earlyToday = event('e', {
            status: 'SCHEDULE',
            scheduledAt: '2026-10-23T00:30:00.000-12:00',
        })
        expect(eventStatus(lateLastNight, today)).toBe('overdue')
        expect(eventStatus(earlyToday, today)).toBe('scheduled')
    })

    it('does not mark a due SCHEDULE event overdue by status alone', () => {
        const active = event('e', {
            status: 'ACTIVE',
            scheduledAt: '2020-01-01T00:00:00.000',
        })
        expect(isOverdue(active, today)).toBe(false)
    })
})

describe('todayIso', () => {
    it('matches /^\\d{4}-\\d{2}-\\d{2}$/', () => {
        expect(todayIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('is the local date, not the UTC one', () => {
        const now = new Date()
        const pad = (n: number) => String(n).padStart(2, '0')
        expect(todayIso()).toBe(
            `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        )
    })
})
