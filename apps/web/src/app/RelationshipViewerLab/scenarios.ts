import type { NodeRecord } from '@/components/relationship-viewer/domain/model'
// The lab is never installed, so it borrows the block's test fixtures.
import {
    chains,
    cycle,
    link,
    person,
    superspreaders,
    withLinks,
} from '@/components/relationship-viewer/__tests__/fixtures'
import i18n from '../../i18n'

export const SCENARIO_IDS = [
    'chains',
    'hubs',
    'cycle',
    'lone',
    'outbreak',
    'household',
    'messy',
] as const
export type ScenarioId = (typeof SCENARIO_IDS)[number]

export interface Scenario {
    id: ScenarioId
    label: () => string
    records: readonly NodeRecord[]
    seeds: readonly string[] // tracked entity ids
    hops: number // the default when the URL sets none
    fail?: readonly string[] // ids the fake server answers with a 404
}

const DAY_MS = 86_400_000
const BASE_DAY = Date.UTC(2026, 2, 1)
const dayOf = (n: number): string =>
    new Date(BASE_DAY + n * DAY_MS).toISOString().slice(0, 10)

/** Fixture records carry no name; the lab's labelOf reads this attribute. */
const named = (record: NodeRecord, name: string): NodeRecord => ({
    ...record,
    attributes: [{ attribute: 'name', value: name }],
})

const undated = (record: NodeRecord): NodeRecord => ({
    ...record,
    enrollments: record.enrollments.map((enrollment) => {
        const copy = { ...enrollment }
        delete copy.enrolledAt
        return copy
    }),
})

/** Fixed-seed LCG, so the same size always gives the same outbreak. */
const lcg = (seed: number): (() => number) => {
    let state = seed
    return () =>
        (state = (1664525 * state + 1013904223) % 4294967296) / 4294967296
}

function outbreak(size: number): Pick<Scenario, 'records' | 'seeds'> {
    const random = lcg(size)
    const people: NodeRecord[] = []
    const links = []
    const days = new Map<string, number>()
    const add = (id: string, day: number) => {
        days.set(id, day)
        const followUp = id !== 'P0' && random() < 1 / 8
        people.push(
            named(
                person(id, { enrolledAt: dayOf(day), followUp }),
                `Person ${id}`
            )
        )
    }
    add('P0', 0)
    const queue = ['P0']
    let next = 1
    while (next < size) {
        const parent = queue.shift()!
        let children = Math.floor(random() * 7)
        // Never let the tree die out before it reaches its size.
        if (queue.length === 0 && children === 0) children = 1
        for (let i = 0; i < children && next < size; i++, next++) {
            const id = `P${next}`
            add(id, days.get(parent)! + Math.floor(random() * 6))
            links.push(link(`L${next}`, parent, id))
            queue.push(id)
        }
    }
    return { records: withLinks(people, links), seeds: ['P0'] }
}

function household(): Pick<Scenario, 'records' | 'seeds'> {
    const contacts = Array.from({ length: 8 }, (_, i) => `HH${i + 2}`)
    return {
        records: withLinks(
            [
                named(person('HH1', { enrolledAt: dayOf(0) }), 'Mariama Sesay'),
                ...contacts.map((id, i) =>
                    named(
                        person(id, { enrolledAt: dayOf(2), followUp: true }),
                        `Household contact ${i + 1}`
                    )
                ),
            ],
            contacts.map((id) => link(`HH1-${id}`, 'HH1', id))
        ),
        seeds: ['HH1'],
    }
}

function messy(): Pick<Scenario, 'records' | 'seeds' | 'fail'> {
    const contact = (n: number, day: number, name = `Contact M${n}`) =>
        named(person(`M${n}`, { enrolledAt: dayOf(day) }), name)
    const people = [
        named(person('M1', { enrolledAt: dayOf(0) }), 'Index case M1'),
        // Five on one day.
        ...[2, 3, 4, 5, 6].map((n) => contact(n, 3)),
        undated(contact(7, 0, 'No date M7')),
        undated(contact(8, 0, 'No date M8')),
        contact(9, 180, 'Six months later M9'),
        contact(
            10,
            4,
            'Fatmata Kamara-Bangura, Village of Upper Bambara Chiefdom, Kailahun District'
        ),
        contact(
            11,
            5,
            'Mohamed Abdulai Conteh-Sesay (reported by neighbour, unconfirmed)'
        ),
        contact(12, 4, 'Fails to load M12'),
        contact(13, 4, 'Fails to load M13'),
        // Past the hop limit: they show as unloaded links on M2 and M3.
        contact(20, 6),
        contact(21, 7),
    ]
    const links = [
        ...[2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((n) =>
            link(`M1-M${n}`, 'M1', `M${n}`)
        ),
        link('M2-M20', 'M2', 'M20'),
        link('M3-M21', 'M3', 'M21', { type: 'contact', bidirectional: true }),
    ]
    return {
        records: withLinks(people, links),
        seeds: ['M1'],
        fail: ['M12', 'M13'],
    }
}

const nameAll = (records: NodeRecord[]) =>
    records.map((r) => named(r, `Person ${r.ref.id}`))

export function scenario(id: ScenarioId, size: number): Scenario {
    switch (id) {
        case 'chains':
            return {
                id,
                label: () => i18n.t('Four chains of six'),
                records: nameAll(chains()),
                seeds: ['A1', 'B1', 'C1', 'D1'],
                hops: 5,
            }
        case 'hubs':
            return {
                id,
                label: () => i18n.t('Three hubs of twelve'),
                records: nameAll(superspreaders()),
                seeds: ['H1', 'H2', 'H3'],
                hops: 1,
            }
        case 'cycle':
            return {
                id,
                label: () => i18n.t('A two-way cycle'),
                records: nameAll(cycle()),
                seeds: ['C1'],
                hops: 3,
            }
        case 'lone':
            return {
                id,
                label: () => i18n.t('A lone case'),
                records: [named(person('L1'), 'Lone case L1')],
                seeds: ['L1'],
                hops: 1,
            }
        case 'outbreak':
            return {
                id,
                label: () => i18n.t('Generated outbreak'),
                ...outbreak(size),
                hops: 6,
            }
        case 'household':
            return {
                id,
                label: () => i18n.t('Household, all need attention'),
                ...household(),
                hops: 1,
            }
        case 'messy':
            return {
                id,
                label: () => i18n.t('Messy data'),
                ...messy(),
                hops: 1,
            }
    }
}
