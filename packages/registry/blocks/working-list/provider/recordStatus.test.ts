import type { WorkingListDisplayRow } from '@/components/working-list'
import { getWorkingListRecordStatus } from './recordStatus'

const row = (values: Record<string, string>): WorkingListDisplayRow => ({
    id: 'Record00001',
    values: Object.fromEntries(
        Object.entries(values).map(([id, value]) => [
            id,
            { valid: true, value },
        ])
    ),
    issues: [],
})
const cellText = () => ''

describe('working list record status', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-02T00:30:00Z'))
    })
    afterEach(() => vi.useRealTimers())

    it('uses the server time zone when deciding whether a scheduled visit is overdue', () => {
        const visit = row({
            eventStatus: 'SCHEDULE',
            eventScheduledAt: '2026-11-01T00:00:00',
        })
        expect(getWorkingListRecordStatus(visit, cellText, 'UTC')?.id).toBe(
            'OVERDUE'
        )
        expect(
            getWorkingListRecordStatus(visit, cellText, 'America/Los_Angeles')
                ?.id
        ).toBe('SCHEDULE')
    })

    it('ignores invalid cells and unknown statuses', () => {
        const visit = row({
            eventStatus: 'unknown',
            enrollmentStatus: 'COMPLETED',
        })
        expect(getWorkingListRecordStatus(visit, cellText, 'UTC')?.id).toBe(
            'COMPLETED'
        )
        const invalid: WorkingListDisplayRow = {
            ...visit,
            values: {
                ...visit.values,
                enrollmentStatus: {
                    valid: false,
                    raw: 'COMPLETED',
                    message: 'Invalid status',
                },
            },
        }
        expect(
            getWorkingListRecordStatus(invalid, cellText, 'UTC')
        ).toBeUndefined()
    })

    it('marks scheduled visits before today overdue', () => {
        expect(
            getWorkingListRecordStatus(
                row({
                    eventStatus: 'SCHEDULE',
                    eventScheduledAt: '2026-10-30T00:00:00.000',
                }),
                cellText,
                'UTC'
            )
        ).toMatchObject({ id: 'OVERDUE' })
    })

    it('keeps visits scheduled from today on as scheduled', () => {
        expect(
            getWorkingListRecordStatus(
                row({
                    eventStatus: 'SCHEDULE',
                    eventScheduledAt: '2026-11-02T00:00:00.000',
                }),
                () => 'Scheduled',
                'UTC'
            )
        ).toEqual({ id: 'SCHEDULE', label: 'Scheduled' })
    })

    it('uses the enrollment status for tracked entities', () => {
        expect(
            getWorkingListRecordStatus(
                row({ enrollmentStatus: 'COMPLETED' }),
                cellText,
                'UTC'
            )
        ).toEqual({ id: 'COMPLETED', label: 'COMPLETED' })
    })

    it('gives no status when the row has none', () => {
        expect(getWorkingListRecordStatus(row({}), cellText, 'UTC')).toBe(
            undefined
        )
    })
})
