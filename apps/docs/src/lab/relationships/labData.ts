/**
 * The lab's outbreak: a seeded, deterministic world of people, contact links and lab results that the lab server
 * answers from as DHIS2 would. Every knob here is something real contact-tracing data does.
 */

export const LAB_PROGRAM = 'labCtProg01'
export const LAB_ORG_UNIT = 'labOrgUnit1'
const OTHER_PROGRAM = 'labOtherPrg'
export const PERSON_TYPE = 'labPersonTp'
export const LAB_STAGE = 'labStgLab01'

export const ATTRIBUTES = {
    firstName: 'labAttFirst',
    lastName: 'labAttLastN',
    sex: 'labAttSex01',
    age: 'labAttAge01',
    village: 'labAttVillg',
    classification: 'labAttClass',
    lastFollowUp: 'labAttFollw',
} as const

export const DATA_ELEMENTS = { test: 'labDeTest01', result: 'labDeResult' }

export const RELATIONSHIP_TYPES = {
    contact: {
        id: 'labRtContct',
        name: 'Was in contact with',
        bidirectional: false,
    },
    household: {
        id: 'labRtHouse1',
        name: 'Same household',
        bidirectional: true,
    },
    labResult: {
        id: 'labRtLabRes',
        name: 'Lab result for',
        bidirectional: false,
    },
} as const

export type Spread = 'chains' | 'hubs' | 'households' | 'mixed'

export interface LabData {
    spread: Spread
    people: number
    /** Percentages of contacts. */
    attention: number // marked for follow-up
    overdue: number // last follow-up more than a few days ago
    completed: number // follow-up finished, enrollment completed
    undated: number // no enrollment date
    outOfProgram: number // enrolled in another program only
    failing: number // the record read fails
    sameDay: boolean // every contact enrolled the day after their exposer
    longNames: boolean
    events: boolean // confirmed cases carry a linked lab result event
    seed: number
}

type Classification = 'Confirmed' | 'Probable' | 'Contact'

export interface LabPerson {
    id: string
    index: boolean
    classification: Classification
    attributes: Record<string, string>
    program: string
    status: 'ACTIVE' | 'COMPLETED'
    followUp: boolean
    enrolledAt?: string
    occurredAt?: string
}

export interface LabLink {
    id: string
    type: string
    bidirectional: boolean
    createdAt: string
    from: { kind: 'trackedEntity' | 'event'; id: string }
    to: { kind: 'trackedEntity' | 'event'; id: string }
}

interface LabEvent {
    id: string
    occurredAt: string
    test: string
    result: string
}

export interface World {
    people: ReadonlyMap<string, LabPerson>
    events: ReadonlyMap<string, LabEvent>
    links: readonly LabLink[]
    failing: ReadonlySet<string>
    indexCase: string
}

const FIRST = {
    F: ['Fatmata', 'Aminata', 'Isata', 'Mariama', 'Kadiatu', 'Hawa', 'Adama'],
    M: ['Mohamed', 'Abu', 'Ibrahim', 'Alhaji', 'Sahr', 'Foday', 'Musa'],
}
const LAST = [
    'Kamara',
    'Sesay',
    'Bangura',
    'Conteh',
    'Koroma',
    'Turay',
    'Jalloh',
    'Kargbo',
    'Mansaray',
    'Fofanah',
]
const VILLAGES = [
    'Ngelehun',
    'Bandajuma',
    'Pendembu',
    'Mano Junction',
    'Kailahun Town',
    'Daru',
    'Segbwema',
]
const LONG_LAST = 'Kamara-Bangura of the Upper Bambara Chiefdom'
const TESTS = ['RT-PCR', 'GeneXpert', 'Rapid antigen']

const DAY_MS = 86_400_000
const isoDay = (date: Date) => date.toISOString().slice(0, 10)

/** Fixed-seed LCG, so the same settings always give the same outbreak. */
const lcg = (seed: number): (() => number) => {
    let state = seed >>> 0 || 1
    return () =>
        (state = (1664525 * state + 1013904223) % 4294967296) / 4294967296
}

interface SpreadRule {
    /** How many people this case exposes. */
    contacts(random: () => number): number
    /** Whether the n-th person exposed becomes a case who exposes others. */
    becomesCase(n: number, random: () => number): boolean
    /** Whether the n-th link is a two-way household link. */
    household(n: number, random: () => number): boolean
}

const SPREADS = {
    // One infects one: each case passes it on once and names a contact or two.
    chains: {
        contacts: (random) => 2 + Math.floor(random() * 2),
        becomesCase: (n) => n === 0,
        household: () => false,
    },
    // A few people expose many; most expose almost nobody.
    hubs: {
        contacts: (random) =>
            random() < 0.3
                ? 10 + Math.floor(random() * 16)
                : Math.floor(random() * 3),
        becomesCase: (_, random) => random() < 0.12,
        household: () => false,
    },
    // Each case lives with three to six people and carries it to the next house.
    households: {
        contacts: (random) => 4 + Math.floor(random() * 4),
        becomesCase: (n) => n === 0,
        household: (n) => n > 0,
    },
    mixed: {
        contacts: (random) => Math.floor(random() * 7),
        becomesCase: (_, random) => random() < 0.3,
        household: (_, random) => random() < 0.3,
    },
} satisfies Record<Spread, SpreadRule>

export function generateWorld(data: LabData, today = new Date()): World {
    const random = lcg(data.seed)
    const chance = (percent: number) => random() * 100 < percent
    const pick = <T>(items: readonly T[]) =>
        items[Math.floor(random() * items.length)]
    const start = new Date(today.getTime() - 24 * DAY_MS)
    const dayOf = (day: number) =>
        isoDay(new Date(start.getTime() + day * DAY_MS))

    const people = new Map<string, LabPerson>()
    const days = new Map<string, number>()
    const events = new Map<string, LabEvent>()
    const links: LabLink[] = []
    const failing = new Set<string>()

    const add = (day: number, classification: Classification): LabPerson => {
        const id = `labTe${String(people.size + 1).padStart(5, '0')}`
        const index = people.size === 0
        const contact = classification === 'Contact'
        const sex = random() < 0.5 ? 'F' : 'M'
        const lastName = data.longNames && chance(20) ? LONG_LAST : pick(LAST)
        const undated = !index && chance(data.undated)
        // Overdue: last seen 4–9 days ago; otherwise within the last two days.
        const lastSeen = chance(data.overdue)
            ? 4 + Math.floor(random() * 6)
            : Math.floor(random() * 2)
        const person: LabPerson = {
            id,
            index,
            classification,
            attributes: {
                [ATTRIBUTES.firstName]: pick(FIRST[sex]),
                [ATTRIBUTES.lastName]: lastName,
                [ATTRIBUTES.sex]: sex === 'F' ? 'Female' : 'Male',
                [ATTRIBUTES.age]: String(2 + Math.floor(random() * 70)),
                [ATTRIBUTES.village]: pick(VILLAGES),
                [ATTRIBUTES.classification]: classification,
                ...(contact && {
                    [ATTRIBUTES.lastFollowUp]: isoDay(
                        new Date(today.getTime() - lastSeen * DAY_MS)
                    ),
                }),
            },
            program:
                !index && chance(data.outOfProgram)
                    ? OTHER_PROGRAM
                    : LAB_PROGRAM,
            status: contact && chance(data.completed) ? 'COMPLETED' : 'ACTIVE',
            followUp: contact && chance(data.attention),
        }
        if (!undated) {
            person.enrolledAt = `${dayOf(day)}T09:00:00.000`
            // Symptom onset, a day or two before a case is enrolled.
            person.occurredAt = `${dayOf(day - (contact ? 0 : 1 + Math.floor(random() * 2)))}T00:00:00.000`
        }
        if (!index && chance(data.failing)) failing.add(id)
        people.set(id, person)
        days.set(id, day)
        return person
    }

    const index = add(0, 'Confirmed')
    const rule = SPREADS[data.spread]
    const queue = [index]
    while (queue.length > 0 && people.size < data.people) {
        const source = queue.shift()!
        // The last person who can spread always passes it on, so the outbreak reaches its size.
        const lastHope = queue.length === 0
        const count = Math.max(rule.contacts(random), lastHope ? 1 : 0)
        let spread = false
        for (let n = 0; n < count && people.size < data.people; n++) {
            const isCase: boolean =
                rule.becomesCase(n, random) ||
                (lastHope && !spread && n === count - 1)
            spread ||= isCase
            const day =
                days.get(source.id)! +
                1 +
                (data.sameDay ? 0 : Math.floor(random() * 5))
            let classification: Classification = 'Contact'
            if (isCase) {
                classification = random() < 0.75 ? 'Confirmed' : 'Probable'
            }
            const person = add(day, classification)
            const type = rule.household(n, random)
                ? RELATIONSHIP_TYPES.household
                : RELATIONSHIP_TYPES.contact
            links.push({
                id: `labRel${String(links.length + 1).padStart(5, '0')}`,
                type: type.id,
                bidirectional: type.bidirectional,
                createdAt: `${dayOf(day)}T10:00:00.000`,
                from: { kind: 'trackedEntity', id: source.id },
                to: { kind: 'trackedEntity', id: person.id },
            })
            if (isCase) queue.push(person)
        }
    }

    if (data.events) {
        for (const person of people.values()) {
            if (person.classification !== 'Confirmed') continue
            const id = `labEv${person.id.slice(5)}`
            const occurredAt = `${dayOf(days.get(person.id)! + 1)}T11:00:00.000`
            events.set(id, {
                id,
                occurredAt,
                test: pick(TESTS),
                result: 'Positive',
            })
            links.push({
                id: `labRel${String(links.length + 1).padStart(5, '0')}`,
                type: RELATIONSHIP_TYPES.labResult.id,
                bidirectional: false,
                createdAt: occurredAt,
                from: { kind: 'trackedEntity', id: person.id },
                to: { kind: 'event', id },
            })
        }
    }

    return { people, events, links, failing, indexCase: index.id }
}
