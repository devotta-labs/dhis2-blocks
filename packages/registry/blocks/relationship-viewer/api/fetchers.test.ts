import { ZodError } from 'zod'
import {
    RelationshipViewerBoundaryError,
    createRelationshipViewerClient,
} from './client'
import type { DataEngineLike, DataEngineQuery, DataEngineValue } from './client'
import {
    ENROLLMENT_FIELDS,
    EVENT_FIELDS,
    RELATIONSHIP_FIELDS,
    TRACKED_ENTITY_FIELDS,
    fetchNodeRecord,
    fetchRelationshipMetadata,
    fetchSeedPage,
} from './fetchers'
import { relationshipViewerKeys } from './keys'

// Returns canned JSON for each query in turn and records the queries.
const fakeEngine = (...responses: Record<string, DataEngineValue>[]) => {
    const queries: DataEngineQuery[] = []
    const engine: DataEngineLike = {
        query: async (q) => {
            queries.push(q)
            return responses.shift() ?? {}
        },
    }
    return { client: createRelationshipViewerClient(engine), queries }
}
const wrap = (value: DataEngineValue) => ({ relationshipViewerResource: value })

const item = (kind: string, id: string) => ({ [kind]: { [kind]: id } })
const noLinks = wrap({ relationships: [] })
// Refuses the record read that names a program, as DHIS2 does for a tracked
// entity not enrolled in it, and records each record read's params.
type RequestFailure =
    | { status: number }
    | { type: string; details: { httpStatusCode: number } }
const refusesProgram = (failure: RequestFailure) => {
    const records: unknown[] = []
    const client = createRelationshipViewerClient({
        query: async ({ relationshipViewerResource: request }) => {
            if (request?.resource === 'tracker/relationships') {
                return noLinks
            }
            records.push(request?.params)
            if (request?.params?.program) throw failure
            return wrap({ trackedEntity: 'TE000000001', enrollments: [] })
        },
    })
    return { client, records }
}
const linksOf = (kind: string, id: string) => ({
    resource: 'tracker/relationships',
    params: { [kind]: id, paging: false, fields: RELATIONSHIP_FIELDS },
})

describe('fetchNodeRecord', () => {
    it('requests a tracked entity with its program and fields', async () => {
        const { client, queries } = fakeEngine(
            wrap({
                trackedEntity: 'TE000000001',
                trackedEntityType: 'Type0000001',
                attributes: [
                    { attribute: 'attr1', displayName: 'Name', value: 'Ann' },
                ],
                enrollments: [
                    {
                        enrollment: 'En000000001',
                        program: 'Prog0000001',
                        status: 'ACTIVE',
                        followUp: true,
                        enrolledAt: '2026-01-02',
                    },
                ],
            }),
            noLinks
        )

        const record = await fetchNodeRecord(
            client,
            { kind: 'trackedEntity', id: 'TE000000001' },
            'Prog0000001'
        )

        expect(queries).toEqual([
            {
                relationshipViewerResource: {
                    resource: 'tracker/trackedEntities',
                    id: 'TE000000001',
                    params: {
                        program: 'Prog0000001',
                        fields: TRACKED_ENTITY_FIELDS,
                    },
                },
            },
            {
                relationshipViewerResource: linksOf(
                    'trackedEntity',
                    'TE000000001'
                ),
            },
        ])
        expect(record).toEqual({
            ref: { kind: 'trackedEntity', id: 'TE000000001' },
            trackedEntityType: 'Type0000001',
            attributes: [
                { attribute: 'attr1', displayName: 'Name', value: 'Ann' },
            ],
            dataValues: [],
            enrollments: [
                {
                    enrollment: 'En000000001',
                    program: 'Prog0000001',
                    status: 'ACTIVE',
                    followUp: true,
                    enrolledAt: '2026-01-02',
                },
            ],
            relationships: [],
        })
    })

    it.each([403, 404, 409])(
        'reads a tracked entity without program when DHIS2 answers %i to it',
        async (status) => {
            const { client, records } = refusesProgram({
                type: 'unknown',
                details: { httpStatusCode: status },
            })

            const record = await fetchNodeRecord(
                client,
                { kind: 'trackedEntity', id: 'TE000000001' },
                'Prog0000001'
            )

            expect(records).toEqual([
                { program: 'Prog0000001', fields: TRACKED_ENTITY_FIELDS },
                { fields: TRACKED_ENTITY_FIELDS },
            ])
            expect(record).toMatchObject({
                ref: { kind: 'trackedEntity', id: 'TE000000001' },
                enrollments: [],
            })
        }
    )

    it('keeps other record failures', async () => {
        const failure = { status: 503 }
        const { client, records } = refusesProgram(failure)

        await expect(
            fetchNodeRecord(
                client,
                { kind: 'trackedEntity', id: 'TE000000001' },
                'Prog0000001'
            )
        ).rejects.toBe(failure)
        expect(records).toHaveLength(1)
    })

    it('omits program when none is given', async () => {
        const { client, queries } = fakeEngine(
            wrap({ trackedEntity: 'TE000000001' }),
            noLinks
        )
        await fetchNodeRecord(
            client,
            { kind: 'trackedEntity', id: 'TE000000001' },
            undefined
        )
        expect(queries[0]?.relationshipViewerResource?.params).toEqual({
            fields: TRACKED_ENTITY_FIELDS,
        })
    })

    it('normalises enrollment and event records', async () => {
        const { client, queries } = fakeEngine(
            wrap({
                enrollment: 'En000000001',
                trackedEntity: 'TE000000001',
                program: 'Prog0000001',
                status: 'COMPLETED',
                enrolledAt: '2026-01-02',
                attributes: null,
            }),
            noLinks,
            wrap({
                event: 'Ev000000001',
                program: 'Prog0000001',
                programStage: 'Stage000001',
                occurredAt: '2026-02-03',
                dataValues: [{ dataElement: 'de1', value: '7' }],
            }),
            noLinks
        )

        const enrollment = await fetchNodeRecord(
            client,
            { kind: 'enrollment', id: 'En000000001' },
            'Prog0000001'
        )
        const event = await fetchNodeRecord(
            client,
            { kind: 'event', id: 'Ev000000001' },
            'Prog0000001'
        )

        expect(queries.map((q) => q.relationshipViewerResource)).toEqual([
            {
                resource: 'tracker/enrollments',
                id: 'En000000001',
                params: { fields: ENROLLMENT_FIELDS },
            },
            linksOf('enrollment', 'En000000001'),
            {
                resource: 'tracker/events',
                id: 'Ev000000001',
                params: { fields: EVENT_FIELDS },
            },
            linksOf('event', 'Ev000000001'),
        ])
        expect(enrollment).toEqual({
            ref: { kind: 'enrollment', id: 'En000000001' },
            attributes: [],
            dataValues: [],
            enrollments: [
                {
                    enrollment: 'En000000001',
                    program: 'Prog0000001',
                    status: 'COMPLETED',
                    followUp: false,
                    enrolledAt: '2026-01-02',
                },
            ],
            relationships: [],
        })
        expect(event).toEqual({
            ref: { kind: 'event', id: 'Ev000000001' },
            program: 'Prog0000001',
            programStage: 'Stage000001',
            occurredAt: '2026-02-03',
            attributes: [],
            dataValues: [{ dataElement: 'de1', value: '7' }],
            enrollments: [],
            relationships: [],
        })
    })

    it('normalises relationship items of every kind', async () => {
        const { client } = fakeEngine(
            wrap({ trackedEntity: 'TE000000001' }),
            wrap({
                relationships: [
                    {
                        relationship: 'Rel00000001',
                        relationshipType: 'Type0000001',
                        bidirectional: true,
                        createdAt: '2026-03-01',
                        from: item('trackedEntity', 'TE000000001'),
                        to: item('enrollment', 'En000000002'),
                    },
                    {
                        relationship: 'Rel00000002',
                        relationshipType: 'Type0000001',
                        from: item('event', 'Ev000000003'),
                        to: item('trackedEntity', 'TE000000001'),
                    },
                    {
                        relationship: 'Rel00000003',
                        relationshipType: 'Type0000001',
                        bidirectional: false,
                        from: {},
                        to: item('event', 'Ev000000004'),
                    },
                ],
            })
        )

        const record = await fetchNodeRecord(
            client,
            { kind: 'trackedEntity', id: 'TE000000001' },
            undefined
        )

        expect(record.relationships).toEqual([
            {
                relationship: 'Rel00000001',
                relationshipType: 'Type0000001',
                bidirectional: true,
                createdAt: '2026-03-01',
                from: { kind: 'trackedEntity', id: 'TE000000001' },
                to: { kind: 'enrollment', id: 'En000000002' },
            },
            {
                relationship: 'Rel00000002',
                relationshipType: 'Type0000001',
                bidirectional: false,
                from: { kind: 'event', id: 'Ev000000003' },
                to: { kind: 'trackedEntity', id: 'TE000000001' },
            },
        ])
        // The relationship with an unresolvable side is counted, not dropped silently.
        expect(record.unresolvedLinkCount).toBe(1)
    })

    it('records with every side resolved carry no unresolved count', async () => {
        const { client } = fakeEngine(
            wrap({ trackedEntity: 'TE000000001' }),
            noLinks
        )
        const record = await fetchNodeRecord(
            client,
            { kind: 'trackedEntity', id: 'TE000000001' },
            undefined
        )
        expect(record).not.toHaveProperty('unresolvedLinkCount')
    })

    it('takes a one-way inbound link from the relationships list', async () => {
        // The record endpoint omits one-way links where the record is the `to` side.
        const { client } = fakeEngine(
            wrap({ event: 'Ev000000001', relationships: [] }),
            wrap({
                relationships: [
                    {
                        relationship: 'Rel00000001',
                        relationshipType: 'Type0000001',
                        bidirectional: false,
                        from: item('trackedEntity', 'TE000000001'),
                        to: item('event', 'Ev000000001'),
                    },
                ],
            })
        )

        const record = await fetchNodeRecord(
            client,
            { kind: 'event', id: 'Ev000000001' },
            undefined
        )

        expect(record.relationships).toEqual([
            {
                relationship: 'Rel00000001',
                relationshipType: 'Type0000001',
                bidirectional: false,
                from: { kind: 'trackedEntity', id: 'TE000000001' },
                to: { kind: 'event', id: 'Ev000000001' },
            },
        ])
    })

    it('rejects malformed relationship lists with a boundary error', async () => {
        const { client } = fakeEngine(
            wrap({ trackedEntity: 'TE000000001' }),
            wrap({ relationships: [{ relationship: 7 }] })
        )
        await expect(
            fetchNodeRecord(
                client,
                { kind: 'trackedEntity', id: 'TE000000001' },
                undefined
            )
        ).rejects.toBeInstanceOf(RelationshipViewerBoundaryError)
    })

    it('rejects malformed records with a boundary error', async () => {
        const { client } = fakeEngine(wrap({ trackedEntity: 7 }), noLinks)
        // A short sentence; the Zod issues stay in `cause`.
        await expect(
            fetchNodeRecord(
                client,
                { kind: 'trackedEntity', id: 'TE000000001' },
                undefined
            )
        ).rejects.toMatchObject({
            name: 'RelationshipViewerBoundaryError',
            message: 'DHIS2 returned a malformed trackedEntity TE000000001.',
            cause: expect.any(ZodError),
        })
    })

    it('lets operational failures through unwrapped', async () => {
        const failure = { status: 503 }
        const client = createRelationshipViewerClient({
            query: () => Promise.reject(failure),
        })
        await expect(
            fetchNodeRecord(
                client,
                { kind: 'event', id: 'Ev000000001' },
                undefined
            )
        ).rejects.toBe(failure)
    })
})

describe('fetchSeedPage', () => {
    it('seed pages return refs and report hasMore', async () => {
        const full = Array.from({ length: 50 }, (_, i) => ({
            trackedEntity: `TE${i}`,
        }))
        const { client, queries } = fakeEngine(
            wrap({ trackedEntities: full }),
            wrap({ trackedEntities: full.slice(0, 3) })
        )

        const first = await fetchSeedPage(
            client,
            { program: 'Prog0000001', orgUnit: 'OU000000001' },
            1
        )
        const last = await fetchSeedPage(client, { program: 'Prog0000001' }, 2)

        expect(queries[0]?.relationshipViewerResource).toEqual({
            resource: 'tracker/trackedEntities',
            params: {
                program: 'Prog0000001',
                orgUnit: 'OU000000001',
                page: 1,
                pageSize: 50,
                fields: 'trackedEntity',
            },
        })
        expect(first.refs).toHaveLength(50)
        expect(first.refs[0]).toEqual({ kind: 'trackedEntity', id: 'TE0' })
        expect(first.hasMore).toBe(true)
        expect(last.refs).toHaveLength(3)
        expect(last.hasMore).toBe(false)
    })
})

describe('fetchRelationshipMetadata', () => {
    const respond = (view: DataEngineValue) =>
        fakeEngine({
            relationshipTypes: {
                relationshipTypes: [
                    {
                        id: 'Type0000001',
                        displayName: 'Contact',
                        bidirectional: false,
                        fromToName: 'Infected',
                        toFromName: 'Infected by',
                        fromConstraint: {
                            relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
                            trackerDataView: view,
                        },
                        toConstraint: {
                            relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
                        },
                    },
                ],
            },
            trackedEntityTypes: {
                trackedEntityTypes: [
                    {
                        id: 'TeType00001',
                        trackedEntityTypeAttributes: [
                            {
                                displayInList: true,
                                trackedEntityAttribute: { id: 'attr1' },
                            },
                            {
                                displayInList: false,
                                trackedEntityAttribute: { id: 'attr2' },
                            },
                        ],
                    },
                ],
            },
        })

    it('metadata accepts both trackerDataView shapes', async () => {
        for (const view of [
            { attributes: [{ id: 'attr1' }], dataElements: [{ id: 'de1' }] },
            { attributes: ['attr1'], dataElements: ['de1'] },
        ]) {
            const { client, queries } = respond(view)
            const metadata = await fetchRelationshipMetadata(client)

            expect(Object.keys(queries[0] ?? {})).toEqual([
                'relationshipTypes',
                'trackedEntityTypes',
            ])
            expect(queries).toHaveLength(1)
            expect(metadata.types.get('Type0000001')).toEqual({
                id: 'Type0000001',
                displayName: 'Contact',
                bidirectional: false,
                fromToName: 'Infected',
                toFromName: 'Infected by',
                from: {
                    relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
                    trackerDataView: {
                        attributes: ['attr1'],
                        dataElements: ['de1'],
                    },
                },
                to: {
                    relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
                    trackerDataView: { attributes: [], dataElements: [] },
                },
            })
            expect(
                metadata.trackedEntityTypeDisplayAttributes.get('TeType00001')
            ).toEqual(['attr1'])
        }
    })

    it('treats a missing trackerDataView as empty', async () => {
        const { client } = respond(undefined)
        const metadata = await fetchRelationshipMetadata(client)
        expect(metadata.types.get('Type0000001')?.from.trackerDataView).toEqual(
            {
                attributes: [],
                dataElements: [],
            }
        )
    })
})

describe('relationshipViewerKeys', () => {
    it('builds stable query keys', () => {
        expect(relationshipViewerKeys.all).toEqual(['relationship-viewer'])
        expect(relationshipViewerKeys.metadata()).toEqual([
            'relationship-viewer',
            'metadata',
        ])
        expect(
            relationshipViewerKeys.node({ kind: 'event', id: 'E1' }, undefined)
        ).toEqual(['relationship-viewer', 'node', 'event', 'E1', null])
        expect(
            relationshipViewerKeys.seeds({ program: 'P1', page: 2 })
        ).toEqual(['relationship-viewer', 'seeds', { program: 'P1', page: 2 }])
    })
})
