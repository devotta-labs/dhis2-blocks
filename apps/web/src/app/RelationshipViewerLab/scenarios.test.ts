import { scenario } from './scenarios'

const nameOf = (record: { attributes: readonly { value: string }[] }) =>
    record.attributes[0]?.value ?? ''

test('the outbreak is deterministic and sized', () => {
    const first = scenario('outbreak', 300)
    expect(scenario('outbreak', 300).records).toEqual(first.records)
    expect(first.records).toHaveLength(300)
    const incoming = new Map<string, number>()
    for (const record of first.records) {
        for (const link of record.relationships) {
            if (link.from.id === record.ref.id) {
                incoming.set(link.to.id, (incoming.get(link.to.id) ?? 0) + 1)
            }
        }
    }
    const [root, ...rest] = first.records
    expect(incoming.has(root.ref.id)).toBe(false)
    for (const record of rest) {
        expect(incoming.get(record.ref.id)).toBe(1)
    }
})

test('the household needs attention everywhere', () => {
    const { records, seeds } = scenario('household', 0)
    const contacts = records.filter((r) => !seeds.includes(r.ref.id))
    expect(contacts).toHaveLength(8)
    for (const contact of contacts) {
        expect(contact.enrollments[0].followUp).toBe(true)
    }
})

test('the messy scenario is messy', () => {
    const { records, fail = [] } = scenario('messy', 0)
    const dates = records.map((r) => r.enrollments[0]?.enrolledAt)
    expect(dates.filter((d) => d === undefined)).toHaveLength(2)
    const counts = new Map<string, number>()
    dates.forEach((d) => d && counts.set(d, (counts.get(d) ?? 0) + 1))
    expect(Math.max(...counts.values())).toBeGreaterThanOrEqual(5)
    expect(records.some((r) => nameOf(r).length > 60)).toBe(true)
    expect(fail).toHaveLength(2)
})

test('every scenario has its seeds among its records', () => {
    for (const id of [
        'chains',
        'hubs',
        'cycle',
        'lone',
        'outbreak',
        'household',
        'messy',
    ] as const) {
        const { records, seeds } = scenario(id, 50)
        const ids = new Set(records.map((r) => r.ref.id))
        expect(seeds.every((seed) => ids.has(seed))).toBe(true)
    }
})
