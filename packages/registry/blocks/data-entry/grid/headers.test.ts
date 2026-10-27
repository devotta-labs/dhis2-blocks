import { rowLabel } from './headers'

const DAY_FIRST = { calendar: 'gregorian', dateFormat: 'DD-MM-YYYY' } as const

test('a row is named by its event date, else by the day it is scheduled for, in the system’s format', () => {
    const row = {
        id: 'e1',
        label: '2026-11-02 · Second visit',
        stage: 'Second visit',
    }
    expect(rowLabel(row, '2026-10-20', DAY_FIRST)).toBe(
        '20-10-2026 · Second visit'
    )
    expect(
        rowLabel({ ...row, scheduledAt: '2026-11-02' }, undefined, DAY_FIRST)
    ).toBe('02-11-2026 · Second visit')
    expect(
        rowLabel({ id: 'e2', label: 'New event' }, undefined, DAY_FIRST)
    ).toBe('New event')
})
