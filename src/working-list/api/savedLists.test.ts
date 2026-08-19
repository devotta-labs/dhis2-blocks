import type {
    WorkingListConfiguration,
    WorkingListField,
} from '../domain/model'
import {
    getSystemFilterDefinition,
    systemColumnFields,
} from '../registry/systemFilters'
import { resolveWorkingListCapabilities } from './capabilities'
import type { WorkingListClient } from './client'
import type { ProgramFieldCatalog } from './metadata'
import {
    buildSavedListPayload,
    normalizeSavedWorkingListResource,
    repairSavedWorkingList,
    replaceSavedWorkingList,
} from './savedLists'
import {
    MutationResponseSchema,
    TrackedEntityInstanceFilterSchema,
} from './schemas'

const attribute: WorkingListField = {
    id: 'Attribute01',
    displayName: 'First name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}

const systemFields = [
    ...systemColumnFields,
    ...['enrollmentStatus', 'enrolledAt', 'enrollmentOccurredAt'].map((id) => {
        const definition = getSystemFilterDefinition(id)
        if (!definition) {
            throw new Error(`Missing ${id}`)
        }
        return definition.field
    }),
]

const metadata: ProgramFieldCatalog = {
    fields: new Map(
        [...systemFields, attribute].map((field) => [field.id, field])
    ),
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    defaultTrackedEntityColumns: [attribute.id],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set(),
}

const configuration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    programId: 'Program0001',
    columns: [attribute.id],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters: [
        {
            field: attribute,
            operator: 'like',
            value: { kind: 'text', value: 'Test' },
        },
    ],
}

const savedResource = {
    id: 'SavedList01',
    displayName: 'My list',
    sortOrder: 7,
    program: { id: 'Program0001' },
    entityQueryCriteria: {
        displayColumnOrder: [attribute.id],
        order: 'createdAt:desc',
        attributeValueFilters: [{ attribute: attribute.id, like: 'Test' }],
    },
    publicAccess: '--------',
    externalAccess: false,
    userAccesses: [],
    userGroupAccesses: [],
}

describe('saved-list payloads', () => {
    it('emits explicit private sharing and only persistent list state', () => {
        const payload = buildSavedListPayload({
            name: 'My list',
            configuration,
            fields: metadata.fields,
            capabilities: metadata.capabilities,
        })

        expect(payload).toEqual({
            resource: 'trackedEntityInstanceFilters',
            data: {
                name: 'My list',
                program: { id: 'Program0001' },
                publicAccess: '--------',
                externalAccess: false,
                userAccesses: [],
                userGroupAccesses: [],
                entityQueryCriteria: {
                    displayColumnOrder: ['Attribute01'],
                    order: 'createdAt:desc',
                    attributeValueFilters: [
                        { attribute: 'Attribute01', like: 'Test' },
                    ],
                },
            },
        })
        expect(JSON.stringify(payload)).not.toMatch(
            /pageSize|"page"|columnWidth/
        )
    })

    it('preserves writable sharing and omits computed access', () => {
        const payload = buildSavedListPayload({
            name: 'Shared list',
            configuration,
            fields: metadata.fields,
            capabilities: metadata.capabilities,
            sharing: {
                access: { read: true, update: true },
                publicAccess: 'r-------',
                externalAccess: true,
                user: { id: 'UserId00001' },
                userAccesses: [{ id: 'UserId00002', access: 'rw------' }],
                userGroupAccesses: [{ id: 'GroupId0001', access: 'r-------' }],
            },
        })

        expect(payload.data).toMatchObject({
            publicAccess: 'r-------',
            externalAccess: true,
            user: { id: 'UserId00001' },
        })
        expect(payload.data).not.toHaveProperty('access')
    })

    it('normalizes a resource and round-trips its query criteria', () => {
        const normalized = normalizeSavedWorkingListResource({
            resource: savedResource,
            type: 'trackedEntityInstanceFilters',
            programId: 'Program0001',
            metadata,
        })

        expect(normalized).toMatchObject({
            compatibility: 'compatible',
            configuration,
            raw: savedResource,
        })
        if (normalized.compatibility !== 'compatible') {
            throw new Error('Expected a compatible list')
        }
        expect(
            buildSavedListPayload({
                name: normalized.name,
                configuration: normalized.configuration,
                fields: metadata.fields,
                capabilities: metadata.capabilities,
                sharing: normalized.sharing,
                existingResource: normalized.raw,
            })
        ).toMatchObject({
            resource: 'trackedEntityInstanceFilters',
            data: {
                sortOrder: 7,
                entityQueryCriteria: savedResource.entityQueryCriteria,
                publicAccess: '--------',
            },
        })
    })

    it('preserves sort order and forward-compatible criteria extensions only', () => {
        const existingResource = TrackedEntityInstanceFilterSchema.parse({
            ...savedResource,
            href: '/api/trackedEntityInstanceFilters/SavedList01',
            created: '2026-08-18T00:00:00.000',
            entityQueryCriteria: {
                ...savedResource.entityQueryCriteria,
                futureCriterion: { enabled: true },
                attributeValueFilters: [
                    {
                        ...savedResource.entityQueryCriteria
                            .attributeValueFilters[0],
                        futureFilterSetting: 'keep-me',
                    },
                ],
            },
        })

        const payload = buildSavedListPayload({
            name: 'Renamed list',
            configuration,
            fields: metadata.fields,
            capabilities: metadata.capabilities,
            existingResource,
        })

        expect(payload.data).toMatchObject({
            name: 'Renamed list',
            sortOrder: 7,
            entityQueryCriteria: {
                futureCriterion: { enabled: true },
                attributeValueFilters: [
                    {
                        attribute: attribute.id,
                        like: 'Test',
                        futureFilterSetting: 'keep-me',
                    },
                ],
            },
        })
        expect(payload.data).not.toHaveProperty('href')
        expect(payload.data).not.toHaveProperty('created')
        expect(payload.data).not.toHaveProperty('access')
    })

    it('fails fast when the saved program is missing or mismatched', () => {
        expect(() =>
            normalizeSavedWorkingListResource({
                resource: { ...savedResource, program: undefined } as never,
                type: 'trackedEntityInstanceFilters',
                programId: 'Program0001',
                metadata,
            })
        ).toThrow()
        expect(() =>
            normalizeSavedWorkingListResource({
                resource: {
                    ...savedResource,
                    program: { id: 'OtherPrg001' },
                },
                type: 'trackedEntityInstanceFilters',
                programId: 'Program0001',
                metadata,
            })
        ).toThrow('belongs to program')
    })

    it('rejects replacing an id through the wrong metadata endpoint', async () => {
        const client: WorkingListClient = {
            query: jest.fn(),
            mutate: jest.fn(),
        }

        await expect(
            replaceSavedWorkingList({
                client,
                id: 'SavedList01',
                resource: 'programStageWorkingLists',
                name: 'My list',
                configuration,
                fields: metadata.fields,
                capabilities: metadata.capabilities,
            })
        ).rejects.toThrow('Cannot replace')
        expect(client.mutate).not.toHaveBeenCalled()
    })

    it('loads the current resource before replace and preserves extensions', async () => {
        const client: WorkingListClient = {
            query: jest.fn().mockResolvedValue(
                TrackedEntityInstanceFilterSchema.parse({
                    ...savedResource,
                    entityQueryCriteria: {
                        ...savedResource.entityQueryCriteria,
                        futureCriterion: 'keep-me',
                    },
                })
            ),
            mutate: jest.fn().mockResolvedValue({ status: 'OK' }),
        }

        await replaceSavedWorkingList({
            client,
            id: savedResource.id,
            resource: 'trackedEntityInstanceFilters',
            name: 'Renamed list',
            configuration,
            fields: metadata.fields,
            capabilities: metadata.capabilities,
        })

        expect(client.query).toHaveBeenCalledWith(
            expect.objectContaining({
                resource: 'trackedEntityInstanceFilters',
                id: savedResource.id,
            }),
            TrackedEntityInstanceFilterSchema
        )
        expect(client.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'replace',
                data: expect.objectContaining({
                    sortOrder: 7,
                    entityQueryCriteria: expect.objectContaining({
                        futureCriterion: 'keep-me',
                    }),
                }),
            }),
            MutationResponseSchema
        )
    })
})

describe('saved-list boundary schemas', () => {
    it('requires successful mutation responses', () => {
        expect(MutationResponseSchema.parse({ status: 'OK' })).toEqual({
            status: 'OK',
        })
        expect(() => MutationResponseSchema.parse({})).toThrow()
        expect(() =>
            MutationResponseSchema.parse({ status: 'ERROR' })
        ).toThrow()
    })

    it('validates known sharing access entries while tolerating additions', () => {
        expect(() =>
            TrackedEntityInstanceFilterSchema.parse({
                ...savedResource,
                userAccesses: [{ id: 'UserId00001', access: 42 }],
            })
        ).toThrow()
        expect(
            TrackedEntityInstanceFilterSchema.parse({
                ...savedResource,
                userAccesses: [
                    {
                        id: 'UserId00001',
                        access: 'rw------',
                        futureSharingField: true,
                    },
                ],
            }).userAccesses
        ).toEqual([
            {
                id: 'UserId00001',
                access: 'rw------',
                futureSharingField: true,
            },
        ])
    })
})

describe('explicit stale saved-list repair', () => {
    it('replaces a stale raw column and returns a replacement-ready payload', () => {
        const list = normalizeSavedWorkingListResource({
            resource: {
                ...savedResource,
                entityQueryCriteria: {
                    ...savedResource.entityQueryCriteria,
                    displayColumnOrder: ['MissingFld1'],
                },
            },
            type: 'trackedEntityInstanceFilters',
            programId: 'Program0001',
            metadata,
        })
        expect(list.compatibility).toBe('incompatible')
        if (list.compatibility !== 'incompatible') {
            throw new Error('Expected an incompatible list')
        }

        const repaired = repairSavedWorkingList({
            list,
            programId: 'Program0001',
            metadata,
            decisions: [
                {
                    path: 'displayColumnOrder.0',
                    action: 'replaceColumn',
                    fieldId: attribute.id,
                },
            ],
        })

        expect(repaired).toMatchObject({
            status: 'repaired',
            configuration: { columns: [attribute.id] },
            payload: { resource: 'trackedEntityInstanceFilters' },
        })
    })

    it('blocks removing the only visible column', () => {
        const list = normalizeSavedWorkingListResource({
            resource: {
                ...savedResource,
                entityQueryCriteria: {
                    ...savedResource.entityQueryCriteria,
                    displayColumnOrder: ['MissingFld1'],
                },
            },
            type: 'trackedEntityInstanceFilters',
            programId: 'Program0001',
            metadata,
        })
        if (list.compatibility !== 'incompatible') {
            throw new Error('Expected an incompatible list')
        }

        expect(
            repairSavedWorkingList({
                list,
                programId: 'Program0001',
                metadata,
                decisions: [{ path: 'displayColumnOrder.0', action: 'remove' }],
            })
        ).toMatchObject({
            status: 'blocked',
            issues: [{ kind: 'noVisibleColumns' }],
        })
    })
})
