import { describe, expect, test } from 'vitest'
import type { SlotDef } from './compileLayout'
import { fillSlots } from './slots'
import type { SlotEvent } from './slots'

const event = (
    id: string,
    programStage: string,
    rest: Partial<SlotEvent> = {}
): SlotEvent => ({ id, programStage, values: {}, ...rest })

const visit = (n: number): SlotDef => ({
    name: `ANC#${n}`,
    stageId: 'ANC',
    kind: 'occurrence',
    occurrence: n,
    hasDateColumn: false,
    label: `Antenatal visit ${n}`,
    stageName: 'Antenatal visit',
})

const dpt = (dose: string): SlotDef => ({
    name: `VAX?dose=${dose}&vaccine=DPT`,
    stageId: 'VAX',
    kind: 'where',
    where: { vaccine: 'DPT', dose },
    hasDateColumn: false,
    label: `Vaccination: DPT ${dose}`,
    stageName: 'Vaccination',
    valuesLabel: `DPT ${dose}`,
})

describe('fillSlots', () => {
    test('repeatable visits fill occurrences in date order, scheduled ones by their due day', () => {
        const { bySlot, notes } = fillSlots(
            [
                event('c', 'ANC', { scheduledAt: '2026-03-01' }),
                event('b', 'ANC', { occurredAt: '2026-02-01' }),
                event('a', 'ANC', { occurredAt: '2026-01-01' }),
            ],
            [visit(1), visit(2), visit(3)]
        )
        expect([...bySlot]).toEqual([
            ['ANC#1', 'a'],
            ['ANC#2', 'b'],
            ['ANC#3', 'c'],
        ])
        expect(notes).toEqual([])
    })

    test('ties by date go by id', () => {
        const { bySlot } = fillSlots(
            [
                event('z', 'ANC', { occurredAt: '2026-01-01' }),
                event('y', 'ANC', { occurredAt: '2026-01-01' }),
            ],
            [visit(1), visit(2)]
        )
        expect(bySlot.get('ANC#1')).toBe('y')
    })

    test('a where slot takes the event holding its values; a second one is noted', () => {
        const { bySlot, notes } = fillSlots(
            [
                event('x', 'VAX', {
                    occurredAt: '2026-01-01',
                    values: { vaccine: 'DPT', dose: '2' },
                }),
                event('y', 'VAX', {
                    occurredAt: '2026-02-01',
                    values: { vaccine: 'DPT', dose: '2' },
                }),
                event('w', 'VAX', {
                    occurredAt: '2026-01-15',
                    values: { vaccine: 'OPV', dose: '2' },
                }),
            ],
            [dpt('2')]
        )
        expect([...bySlot]).toEqual([['VAX?dose=2&vaccine=DPT', 'x']])
        expect(notes).toEqual([
            '2 events of Vaccination hold DPT 2; the first is shown',
        ])
    })

    test('visits beyond the layout are noted', () => {
        const { bySlot, notes } = fillSlots(
            [
                event('a', 'ANC', { occurredAt: '2026-01-01' }),
                event('b', 'ANC', { occurredAt: '2026-02-01' }),
                event('c', 'ANC', { occurredAt: '2026-03-01' }),
                event('d', 'ANC', { occurredAt: '2026-04-01' }),
            ],
            [visit(1), visit(2)]
        )
        expect(bySlot.size).toBe(2)
        expect(notes).toEqual([
            '2 more visits of Antenatal visit not in this register',
        ])
    })

    test('notes name the stage as it is, even with a colon in it', () => {
        const { notes } = fillSlots(
            [
                event('a', 'ANC', { occurredAt: '2026-01-01' }),
                event('b', 'ANC', { occurredAt: '2026-02-01' }),
                event('c', 'ANC', { occurredAt: '2026-03-01' }),
            ],
            [
                {
                    ...visit(1),
                    label: 'Postnatal: mother 1',
                    stageName: 'Postnatal: mother',
                },
            ]
        )
        expect(notes).toEqual([
            '2 more visits of Postnatal: mother not in this register',
        ])
    })

    test('an event fills one slot only', () => {
        const slots: SlotDef[] = [
            dpt('1'),
            { ...visit(1), stageId: 'VAX', name: 'VAX#1' },
        ]
        const { bySlot } = fillSlots(
            [
                event('x', 'VAX', {
                    occurredAt: '2026-01-01',
                    values: { vaccine: 'DPT', dose: '1' },
                }),
            ],
            slots
        )
        expect([...bySlot]).toEqual([['VAX?dose=1&vaccine=DPT', 'x']])
    })
})
