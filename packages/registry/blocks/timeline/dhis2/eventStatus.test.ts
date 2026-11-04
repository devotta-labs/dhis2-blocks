import { deriveEventStatus } from './eventStatus'
import { TrackerEventSchema, type TrackerEvent } from './schemas'

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

const today = '2026-10-22'

describe('deriveEventStatus', () => {
    it('treats a SCHEDULE event due yesterday as overdue and one due today as scheduled', () => {
        expect(
            deriveEventStatus(
                event('SCHEDULE', { scheduledAt: '2026-10-21T00:00:00.000' }),
                today
            )
        ).toBe('overdue')
        expect(
            deriveEventStatus(
                event('SCHEDULE', { scheduledAt: '2026-10-22T00:00:00.000' }),
                today
            )
        ).toBe('scheduled')
        expect(
            deriveEventStatus(
                event('SCHEDULE', { scheduledAt: '2026-11-01' }),
                today
            )
        ).toBe('scheduled')
    })

    it('treats a legacy OVERDUE status as overdue', () => {
        expect(deriveEventStatus(event('OVERDUE'), today)).toBe('overdue')
    })

    it('maps VISITED to active', () => {
        expect(deriveEventStatus(event('VISITED'), today)).toBe('active')
        expect(deriveEventStatus(event('ACTIVE'), today)).toBe('active')
    })

    it('maps COMPLETED and SKIPPED, and reads an unknown status as active', () => {
        expect(deriveEventStatus(event('COMPLETED'), today)).toBe('completed')
        expect(deriveEventStatus(event('SKIPPED'), today)).toBe('skipped')
        expect(deriveEventStatus(event('SOMETHING_NEW'), today)).toBe('active')
    })
})
