import type { WorkingListDisplayRow } from '@/components/working-list'
import { defaultRecordStatus } from './recordStatus'

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

describe('default record status', () => {
    it('marks scheduled visits before today overdue', () => {
        expect(
            defaultRecordStatus(
                row({
                    eventStatus: 'SCHEDULE',
                    eventScheduledAt: '2026-10-30T00:00:00.000',
                }),
                cellText,
                '2026-11-02'
            )
        ).toMatchObject({ id: 'OVERDUE', tone: 'critical' })
    })

    it('keeps visits scheduled from today on as scheduled', () => {
        expect(
            defaultRecordStatus(
                row({
                    eventStatus: 'SCHEDULE',
                    eventScheduledAt: '2026-11-02T00:00:00.000',
                }),
                () => 'Scheduled',
                '2026-11-02'
            )
        ).toEqual({ id: 'SCHEDULE', label: 'Scheduled', tone: 'info' })
    })

    it('uses the enrollment status for tracked entities', () => {
        expect(
            defaultRecordStatus(
                row({ enrollmentStatus: 'COMPLETED' }),
                cellText,
                '2026-11-02'
            )
        ).toEqual({ id: 'COMPLETED', label: 'COMPLETED', tone: 'positive' })
    })

    it('gives no status when the row has none', () => {
        expect(defaultRecordStatus(row({}), cellText, '2026-11-02')).toBe(
            undefined
        )
    })
})
