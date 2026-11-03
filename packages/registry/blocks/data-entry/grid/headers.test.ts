import type { GridTable } from '../model/types'
import { columnHeaderIds, rowLabel } from './headers'

const DAY_FIRST = { calendar: 'gregorian', dateFormat: 'DD-MM-YYYY' } as const

test('a row is named by its event date, else by the day it is scheduled for, in the system’s format', () => {
    const row = {
        id: 'e1',
        label: '2026-11-02 · Second visit',
        stage: 'Second visit',
    }
    const record = {
        kind: 'event',
        id: 'e1',
        programStageId: 's2',
        orgUnitId: 'ou',
        status: 'SCHEDULE',
    } as const
    expect(rowLabel(row, record, '2026-10-20', DAY_FIRST)).toBe(
        '20-10-2026 · Second visit'
    )
    expect(
        rowLabel(
            row,
            { ...record, scheduledAt: '2026-11-02' },
            undefined,
            DAY_FIRST
        )
    ).toBe('02-11-2026 · Second visit')
    expect(
        rowLabel(
            { id: 'e2', label: 'New event' },
            undefined,
            undefined,
            DAY_FIRST
        )
    ).toBe('New event')
})

test('a heading spanning two rows names its column beside a group', () => {
    const table: GridTable = {
        id: 't1',
        title: 'Table t1',
        rows: [],
        columns: ['Name', 'Initiated', 'Completed'].map((label, i) => ({
            id: `c${i}`,
            label,
            field: { valueType: 'INTEGER' },
        })),
        closed: new Map(),
        headerRows: [
            [
                { id: 'name', label: 'Name', span: 1, rowSpan: 2 },
                { id: 'ifa', label: 'IFA', span: 2 },
            ],
            [
                { id: 'init', label: 'Initiated', span: 1 },
                { id: 'done', label: 'Completed', span: 1 },
            ],
        ],
    }
    expect(columnHeaderIds('s', table)).toEqual([
        's-t1-header-name',
        's-t1-header-ifa s-t1-header-init',
        's-t1-header-ifa s-t1-header-done',
    ])
})
