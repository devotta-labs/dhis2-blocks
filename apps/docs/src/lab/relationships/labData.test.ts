import { expect, test } from 'vitest'
import { generateWorld, LAB_PROGRAM, RELATIONSHIP_TYPES } from './labData'
import { answer } from './labServer'
import { DEFAULT_CONFIG, PRESETS } from './presets'

const TODAY = new Date('2026-10-30T12:00:00Z')
const data = DEFAULT_CONFIG.data
const server = { latency: 0, metadata: 'ok' as const }

test('the same settings give the same outbreak', () => {
    const first = generateWorld(data, TODAY)
    const again = generateWorld(data, TODAY)
    expect([...again.people.values()]).toEqual([...first.people.values()])
    expect(again.links).toEqual(first.links)
})

test('every person but the index case was exposed by exactly one link', () => {
    const world = generateWorld({ ...data, people: 200 }, TODAY)
    expect(world.people.size).toBe(200)
    const exposed = world.links.map((link) => link.to.id)
    expect(new Set(exposed).size).toBe(exposed.length)
    expect(exposed).not.toContain(world.indexCase)
})

test('chains pass it on once per case; households link two-way', () => {
    const chains = generateWorld(
        { ...data, spread: 'chains', people: 30 },
        TODAY
    )
    const cases = [...chains.people.values()].filter(
        (person) => person.classification !== 'Contact'
    )
    expect(cases.length).toBeGreaterThan(8)
    const homes = generateWorld({ ...data, spread: 'households' }, TODAY)
    expect(
        homes.links.some(
            (link) =>
                link.type === RELATIONSHIP_TYPES.household.id &&
                link.bidirectional
        )
    ).toBe(true)
})

test('messy settings make messy people, never the index case', () => {
    const world = generateWorld(
        { ...data, people: 200, undated: 100, outOfProgram: 100, failing: 100 },
        TODAY
    )
    const index = world.people.get(world.indexCase)!
    expect(index.enrolledAt).toBeDefined()
    expect(index.program).toBe(LAB_PROGRAM)
    expect(world.failing.has(world.indexCase)).toBe(false)
    const others = [...world.people.values()].filter((p) => !p.index)
    expect(others.every((p) => p.enrolledAt === undefined)).toBe(true)
    expect(others.every((p) => p.program !== LAB_PROGRAM)).toBe(true)
    expect(world.failing.size).toBe(others.length)
})

test('the server answers like DHIS2 42 for people outside the program', async () => {
    const world = generateWorld(
        { ...data, people: 40, outOfProgram: 100 },
        TODAY
    )
    const [, outside] = [...world.people.values()]
    const read = (params: { program?: string }) =>
        answer(world, server, {
            resource: 'tracker/trackedEntities',
            id: outside.id,
            params,
        })
    await expect(read({ program: LAB_PROGRAM })).rejects.toMatchObject({
        details: { httpStatusCode: 404 },
    })
    await expect(read({})).resolves.toMatchObject({ trackedEntity: outside.id })
})

test('relationships come back from both sides', async () => {
    const world = generateWorld(data, TODAY)
    const [link] = world.links
    for (const id of [link.from.id, link.to.id]) {
        const answered = await answer(world, server, {
            resource: 'tracker/relationships',
            params: { trackedEntity: id },
        })
        expect(answered).toMatchObject({
            relationships: expect.arrayContaining([
                expect.objectContaining({ relationship: link.id }),
            ]),
        })
    }
})

test('every preset generates', () => {
    for (const { config } of PRESETS) {
        expect(generateWorld(config.data, TODAY).people.size).toBeGreaterThan(0)
    }
})
