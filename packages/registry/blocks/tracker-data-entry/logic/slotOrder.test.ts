import type { CellMap } from '@/components/spreadsheet'
import type { TrackerRow } from '../model/types'
import type { SlotDef } from '../register/compileLayout'
import { slotOrderWarnings } from './slotOrder'

const visit = (occurrence: number): SlotDef => ({
    name: `visit#${occurrence}`,
    stageId: 'visit',
    kind: 'occurrence',
    occurrence,
    hasDateColumn: true,
    label: `Visit ${occurrence}`,
})
const SLOTS = [visit(1), visit(2), visit(3)]
const ROW: TrackerRow = {
    id: 'en1',
    label: 'Amina',
    slots: { 'visit#1': 'v1', 'visit#2': 'v2', 'visit#3': 'v3' },
}
const dated = (dates: Record<string, string>): CellMap =>
    Object.fromEntries(
        Object.entries(dates).map(([record, value]) => [
            record,
            { occurredAt: { value, sync: 'idle', source: 'person' } },
        ])
    )

test('a 3rd visit dated before the 2nd warns', () => {
    const cells = dated({
        v1: '2026-10-01',
        v2: '2026-10-20',
        v3: '2026-10-10',
    })
    expect(slotOrderWarnings([ROW], cells, SLOTS)).toEqual(
        new Map([
            ['v2.occurredAt', 'Later than the 3rd visit'],
            ['v3.occurredAt', 'Earlier than the 2nd visit'],
        ])
    )
})

test('visits in order, or with gaps between them, say nothing; an empty slot is skipped over', () => {
    expect(
        slotOrderWarnings(
            [ROW],
            dated({ v1: '2026-10-01', v3: '2026-10-10' }),
            SLOTS
        ).size
    ).toBe(0)
    expect(
        slotOrderWarnings(
            [ROW],
            dated({ v1: '2026-10-10', v3: '2026-10-01' }),
            SLOTS
        )
    ).toEqual(
        new Map([
            ['v1.occurredAt', 'Later than the 3rd visit'],
            ['v3.occurredAt', 'Earlier than the 1st visit'],
        ])
    )
})

test('a slot with no date column is compared with, but has no cell to warn on', () => {
    const slots = [{ ...visit(1), hasDateColumn: false }, visit(2)]
    expect(
        slotOrderWarnings(
            [ROW],
            dated({ v1: '2026-10-10', v2: '2026-10-01' }),
            slots
        )
    ).toEqual(new Map([['v2.occurredAt', 'Earlier than the 1st visit']]))
})
