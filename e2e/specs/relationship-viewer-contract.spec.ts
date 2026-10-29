import { z } from 'zod'
import { test, expect } from '../fixtures/test'
import type { APIRequestContext } from '@playwright/test'
import {
    ENROLLMENT_FIELDS,
    EVENT_FIELDS,
    RELATIONSHIP_FIELDS,
    RELATIONSHIP_TYPE_FIELDS,
    TRACKED_ENTITY_FIELDS,
    TRACKED_ENTITY_TYPE_FIELDS,
} from '../../packages/registry/blocks/relationship-viewer/api/fetchers'
import {
    EnrollmentRecordSchema,
    EventRecordSchema,
    MetadataSchema,
    RelationshipListSchema,
    SeedPageSchema,
    TrackedEntityRecordSchema,
} from '../../packages/registry/blocks/relationship-viewer/api/schemas'

const PROGRAM = 'RvE2ePrg001'
const ORG_UNIT = 'DiszpKrYNg8'
const NAME_ATTRIBUTE = 'RvE2eAtt001'

const EmbeddedRelationshipsSchema = z.object({
    relationships: z.array(z.object({ relationship: z.string() })),
})

const te = (id: string) => ({ kind: 'trackedEntity', id })

// The block's relationships request for one node. With paging=false DHIS2 answers a bare
// list; any paged answer carries a pager, so its absence shows nothing is cut to a page.
const relationshipsOf = async (
    dhis2: APIRequestContext,
    kind: 'trackedEntity' | 'enrollment' | 'event',
    id: string
) => {
    const response = await dhis2.get('/api/tracker/relationships', {
        params: { [kind]: id, paging: false, fields: RELATIONSHIP_FIELDS },
    })
    expect(response.ok()).toBe(true)
    const body = await response.json()
    expect(Object.keys(body)).toEqual(['relationships'])
    return RelationshipListSchema.parse(body).relationships
}

test.describe('relationship viewer server contract', () => {
    test('a tracked entity record carries the record fields', async ({
        dhis2,
    }) => {
        const response = await dhis2.get(
            '/api/tracker/trackedEntities/RvE2eTei002',
            { params: { program: PROGRAM, fields: TRACKED_ENTITY_FIELDS } }
        )
        expect(response.ok()).toBe(true)

        expect(
            TrackedEntityRecordSchema.parse(await response.json())
        ).toMatchObject({
            ref: te('RvE2eTei002'),
            trackedEntityType: 'RvE2eTet001',
            attributes: expect.arrayContaining([
                expect.objectContaining({
                    attribute: NAME_ATTRIBUTE,
                    value: 'Chain case 2',
                }),
            ]),
        })
    })

    test("the relationships request returns both sides with the far side's identity", async ({
        dhis2,
    }) => {
        const relationships = await relationshipsOf(
            dhis2,
            'trackedEntity',
            'RvE2eTei002'
        )

        expect(relationships).toHaveLength(2)
        expect(relationships).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    relationship: 'RvE2eRel001',
                    relationshipType: 'RvE2eRlt001',
                    bidirectional: false,
                    from: te('RvE2eTei001'),
                    to: te('RvE2eTei002'),
                }),
                expect.objectContaining({
                    relationship: 'RvE2eRel002',
                    from: te('RvE2eTei002'),
                    to: te('RvE2eTei003'),
                }),
            ])
        )
        expect(relationships[0]?.createdAt).toBeTruthy()
    })

    test("the program's enrollment carries followUp and enrolledAt", async ({
        dhis2,
    }) => {
        const response = await dhis2.get(
            '/api/tracker/trackedEntities/RvE2eTei011',
            { params: { program: PROGRAM, fields: TRACKED_ENTITY_FIELDS } }
        )
        expect(response.ok()).toBe(true)
        const record = TrackedEntityRecordSchema.parse(await response.json())
        const enrollment = record.enrollments.find((e) => e.program === PROGRAM)

        expect(enrollment?.followUp).toBe(true)
        expect(enrollment?.enrolledAt).toMatch(/^2026-02-02/)
        expect(
            await relationshipsOf(dhis2, 'trackedEntity', 'RvE2eTei011')
        ).toEqual([
            expect.objectContaining({
                relationshipType: 'RvE2eRlt002',
                bidirectional: true,
                from: te('RvE2eTei010'),
                to: te('RvE2eTei011'),
            }),
        ])
    })

    test('an event record and its inbound relationship', async ({ dhis2 }) => {
        const response = await dhis2.get('/api/tracker/events/RvE2eEvt001', {
            params: { fields: EVENT_FIELDS },
        })
        expect(response.ok()).toBe(true)

        expect(EventRecordSchema.parse(await response.json())).toMatchObject({
            ref: { kind: 'event', id: 'RvE2eEvt001' },
            program: PROGRAM,
            programStage: 'RvE2eStg001',
        })
        expect(await relationshipsOf(dhis2, 'event', 'RvE2eEvt001')).toEqual([
            expect.objectContaining({
                relationship: 'RvE2eRel017',
                relationshipType: 'RvE2eRlt003',
                from: te('RvE2eTei001'),
                to: { kind: 'event', id: 'RvE2eEvt001' },
            }),
        ])
    })

    // shortcut: the seed has no enrollment-endpoint relationship type, so the list is empty;
    // seed one if enrollment links need coverage.
    test('an enrollment record and its relationships', async ({ dhis2 }) => {
        const response = await dhis2.get(
            '/api/tracker/enrollments/RvE2eEnr001',
            { params: { fields: ENROLLMENT_FIELDS } }
        )
        expect(response.ok()).toBe(true)

        expect(
            EnrollmentRecordSchema.parse(await response.json())
        ).toMatchObject({
            ref: { kind: 'enrollment', id: 'RvE2eEnr001' },
            enrollments: [{ program: PROGRAM, status: 'ACTIVE' }],
        })
        expect(
            await relationshipsOf(dhis2, 'enrollment', 'RvE2eEnr001')
        ).toEqual([])
    })

    test('seed pages list trackedEntities', async ({ dhis2 }) => {
        const response = await dhis2.get('/api/tracker/trackedEntities', {
            params: {
                program: PROGRAM,
                orgUnits: ORG_UNIT,
                page: 1,
                pageSize: 50,
                fields: 'trackedEntity',
            },
        })
        expect(response.ok()).toBe(true)
        const { trackedEntities } = SeedPageSchema.parse(await response.json())

        expect(trackedEntities).toHaveLength(19)
        expect(trackedEntities).toContainEqual(te('RvE2eTei030'))
    })

    // Unfiltered, like the block: the Sierra Leone database's own types must parse too.
    test("the block's metadata request parses", async ({ dhis2 }) => {
        const all = async (resource: string, fields: string) => {
            const response = await dhis2.get(`/api/${resource}`, {
                params: { paging: false, fields },
            })
            expect(response.ok()).toBe(true)
            return response.json()
        }
        const metadata = MetadataSchema.parse({
            relationshipTypes: await all(
                'relationshipTypes',
                RELATIONSHIP_TYPE_FIELDS
            ),
            trackedEntityTypes: await all(
                'trackedEntityTypes',
                TRACKED_ENTITY_TYPE_FIELDS
            ),
        })

        for (const id of ['RvE2eRlt001', 'RvE2eRlt002', 'RvE2eRlt003']) {
            expect(
                metadata.types.get(id)?.from.trackerDataView.attributes
            ).toEqual([NAME_ATTRIBUTE])
        }
        expect(metadata.types.get('RvE2eRlt002')?.bidirectional).toBe(true)
        expect(metadata.types.get('RvE2eRlt003')?.to.relationshipEntity).toBe(
            'PROGRAM_STAGE_INSTANCE'
        )
        expect(
            metadata.trackedEntityTypeDisplayAttributes.get('RvE2eTet001')
        ).toEqual([NAME_ATTRIBUTE, 'RvE2eAtt002'])
    })

    test('paging=false is honoured on the relationships request', async ({
        dhis2,
    }) => {
        const paged = await dhis2.get('/api/tracker/relationships', {
            params: { trackedEntity: 'RvE2eTei010', fields: 'relationship' },
        })
        expect(paged.ok()).toBe(true)
        // A paged answer carries a pager object or flat page fields.
        expect(
            Object.keys(await paged.json()).filter((key) =>
                ['pager', 'page', 'pageSize'].includes(key)
            )
        ).not.toEqual([])

        expect(
            await relationshipsOf(dhis2, 'trackedEntity', 'RvE2eTei010')
        ).toHaveLength(8)
    })

    // Why the block reads tracker/relationships: if this starts failing, the server embeds both sides.
    test('embedded record relationships omit inbound one-way links', async ({
        dhis2,
    }) => {
        const embedded = async (path: string) => {
            const response = await dhis2.get(path, {
                params: { fields: 'relationships[relationship]' },
            })
            expect(response.ok()).toBe(true)
            return EmbeddedRelationshipsSchema.parse(
                await response.json()
            ).relationships.map((r) => r.relationship)
        }

        expect(
            await embedded('/api/tracker/trackedEntities/RvE2eTei002')
        ).toEqual(['RvE2eRel002'])
        expect(await embedded('/api/tracker/events/RvE2eEvt001')).toEqual([])
    })
})
