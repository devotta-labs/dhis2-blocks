import type {
    FetchRecord,
    NodeRecord,
    NodeRef,
    RelationshipLink,
} from '../domain/model'

export const FIXTURE_PROGRAM = 'FixtProg001'

const BASE_DAY = Date.UTC(2026, 0, 1)

/** ISO date `n` days after 2026-01-01. */
const day = (n: number): string =>
    new Date(BASE_DAY + n * 86_400_000).toISOString().slice(0, 10)

const teRef = (id: string): NodeRef => ({ kind: 'trackedEntity', id })

export const person = (
    id: string,
    opts: {
        enrolledAt?: string
        followUp?: boolean
        program?: string
        attributes?: Record<string, string>
    } = {}
): NodeRecord => ({
    ref: teRef(id),
    trackedEntityType: 'FixtTeType1',
    attributes: Object.entries(opts.attributes ?? {}).map(
        ([attribute, value]) => ({ attribute, value })
    ),
    dataValues: [],
    enrollments: [
        {
            enrollment: `${id}-enrollment`,
            program: opts.program ?? FIXTURE_PROGRAM,
            status: 'ACTIVE',
            followUp: opts.followUp ?? false,
            enrolledAt: opts.enrolledAt ?? '2026-01-01',
        },
    ],
    relationships: [],
})

export const link = (
    id: string,
    from: string,
    to: string,
    opts: { type?: string; bidirectional?: boolean } = {}
): RelationshipLink => ({
    relationship: id,
    relationshipType: opts.type ?? 'exposed',
    bidirectional: opts.bidirectional ?? false,
    from: teRef(from),
    to: teRef(to),
})

export const withLinks = (
    records: NodeRecord[],
    links: RelationshipLink[]
): NodeRecord[] =>
    records.map((record) => ({
        ...record,
        relationships: links.filter(
            (l) => l.from.id === record.ref.id || l.to.id === record.ref.id
        ),
    }))

/** 4 chains of 6 cases; each case exposes the next case and one contact. */
export const chains = (): NodeRecord[] => {
    const records: NodeRecord[] = []
    const links: RelationshipLink[] = []
    ;['A', 'B', 'C', 'D'].forEach((letter, i) => {
        for (let n = 1; n <= 6; n++) {
            const id = `${letter}${n}`
            records.push(
                person(id, { enrolledAt: day(i + n - 1) }),
                person(`${id}c`, { enrolledAt: day(i + n) })
            )
            links.push(link(`${id}-c`, id, `${id}c`))
            if (n < 6) {
                links.push(link(`${id}-next`, id, `${letter}${n + 1}`))
            }
        }
    })
    return withLinks(records, links)
}

/** 3 hubs (days 0, 5, 11) with 12 contacts each, 1-3 days after the hub. */
export const superspreaders = (): NodeRecord[] => {
    const records: NodeRecord[] = []
    const links: RelationshipLink[] = []
    ;[0, 5, 11].forEach((hubDay, i) => {
        const hub = `H${i + 1}`
        records.push(person(hub, { enrolledAt: day(hubDay) }))
        for (let n = 1; n <= 12; n++) {
            const id = `${hub}c${String(n).padStart(2, '0')}`
            records.push(person(id, { enrolledAt: day(hubDay + 1 + (n % 3)) }))
            links.push(
                link(`${hub}-${id}`, hub, id, {
                    type: 'contact',
                    bidirectional: true,
                })
            )
        }
    })
    return withLinks(records, links)
}

/** C1-C2-C3-C1, two-way, all enrolled the same day. */
export const cycle = (): NodeRecord[] =>
    withLinks(
        ['C1', 'C2', 'C3'].map((id) => person(id, { enrolledAt: day(0) })),
        [
            link('C1-C2', 'C1', 'C2', { type: 'contact', bidirectional: true }),
            link('C2-C3', 'C2', 'C3', { type: 'contact', bidirectional: true }),
            link('C3-C1', 'C3', 'C1', { type: 'contact', bidirectional: true }),
        ]
    )

export const fakeFetch = (
    records: readonly NodeRecord[],
    opts: { fail?: ReadonlySet<string> } = {}
): FetchRecord & { calls: NodeRef[] } => {
    const calls: NodeRef[] = []
    const fetch = (ref: NodeRef): Promise<NodeRecord> => {
        calls.push(ref)
        const record = records.find(
            (r) => r.ref.kind === ref.kind && r.ref.id === ref.id
        )
        return opts.fail?.has(ref.id) || !record
            ? Promise.reject({ status: 404 })
            : Promise.resolve(record)
    }
    return Object.assign(fetch, { calls })
}
