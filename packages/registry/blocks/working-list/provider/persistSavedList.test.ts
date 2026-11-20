import { resolveWorkingListCapabilities } from '../api/capabilities'
import { ZodError } from 'zod'
import type { ProgramFieldCatalog } from '../api/metadata'
import {
    fetchSavedWorkingLists,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type {
    ProgramStageWorkingList,
    TrackedEntityInstanceFilter,
} from '../api/schemas'
import type { WorkingListConfiguration } from '../domain/model'
import { systemColumnFields } from '../registry/systemFilters'
import {
    openWorkingListServer,
    readRequestJson,
} from '../test/workingListServer'
import { internalConfigurationFingerprint } from './configuration'
import { WorkingListInvalidResponseError } from './errors'
import { persistSavedList } from './persistSavedList'

const capabilities = resolveWorkingListCapabilities({ apiVersion: 43 })
const stageId = 'ProgStage01'
const metadata: ProgramFieldCatalog = {
    fields: new Map(systemColumnFields.map((field) => [field.id, field])),
    fieldsByProgramStage: new Map(),
    capabilities,
    defaultTrackedEntityColumns: ['createdAt'],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set([stageId]),
}
const configuration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    programId: 'Program0001',
    columns: ['createdAt'],
    sort: { fieldId: 'createdAt', direction: 'desc' },
    filters: [],
}
const raw = {
    id: 'SavedList01',
    displayName: 'My list',
    program: { id: configuration.programId },
    sortOrder: 7,
    publicAccess: '--------',
    userAccesses: [{ id: 'User0000001', access: 'rw------' }],
    entityQueryCriteria: { order: 'createdAt:asc', futureCriteria: true },
}
const list: NormalizedSavedWorkingList = {
    id: raw.id,
    name: raw.displayName,
    resource: 'trackedEntityInstanceFilters',
    sharing: {
        publicAccess: raw.publicAccess,
        userAccesses: raw.userAccesses,
    },
    raw,
    compatibility: 'compatible',
    configuration: {
        ...configuration,
        sort: { fieldId: 'createdAt', direction: 'asc' },
    },
}

const confirmed = {
    ...raw,
    entityQueryCriteria: {
        ...raw.entityQueryCriteria,
        order: 'createdAt:desc',
    },
}
const repaired: WorkingListConfiguration = {
    ...configuration,
    mode: 'event',
    programStageId: stageId,
}
const eventRaw = {
    ...raw,
    programStage: { id: stageId },
    programStageQueryCriteria: { order: 'createdAt:asc' },
}
const eventList: NormalizedSavedWorkingList = {
    ...list,
    resource: 'programStageWorkingLists',
    compatibility: 'incompatible',
    raw: eventRaw,
    issues: [],
}
const confirmedEvent = {
    ...eventRaw,
    programStageQueryCriteria: {
        order: 'createdAt:desc',
        displayColumnOrder: repaired.columns,
    },
}

const setup = async ({
    trackedEntityLists = [confirmed],
    eventLists = [],
    programId = configuration.programId,
    writeResponse = Response.json({ status: 'OK' }),
    readResponse,
    respondToWrite,
}: {
    trackedEntityLists?: TrackedEntityInstanceFilter[]
    eventLists?: ProgramStageWorkingList[]
    programId?: string
    writeResponse?: Response
    readResponse?: Response
    respondToWrite?: () => Promise<void>
} = {}) => {
    const writes: Array<{ resource: string; id: string; body: unknown }> = []
    const reads: string[] = []
    const eventRead = Promise.withResolvers<void>()
    const { client } = await openWorkingListServer(
        async ({ pathname, searchParams }, request) => {
            const [, , , resource, id] = pathname.split('/')
            if (
                resource !== 'trackedEntityInstanceFilters' &&
                resource !== 'programStageWorkingLists'
            )
                return
            if (request.method === 'PUT' && id === list.id) {
                writes.push({
                    resource,
                    id,
                    body: await readRequestJson(request),
                })
                await respondToWrite?.()
                return writeResponse
            }
            if (request.method === 'GET' && !id) {
                expect(searchParams.get('filter')).toBe(
                    `program.id:eq:${programId}`
                )
                reads.push(resource)
                if (resource === 'trackedEntityInstanceFilters') {
                    if (readResponse) {
                        await eventRead.promise
                        return readResponse
                    }
                    return Response.json({
                        trackedEntityInstanceFilters: trackedEntityLists,
                    })
                }
                eventRead.resolve()
                return Response.json({ programStageWorkingLists: eventLists })
            }
        }
    )
    const refreshSavedLists = () =>
        fetchSavedWorkingLists({ client, programId, metadata })
    const options = {
        client,
        list,
        configuration,
        metadata,
        capabilities,
        refreshSavedLists,
        operation: 'updateSelectedView' as const,
    }
    return { options, writes, reads }
}

describe('persistSavedList', () => {
    it('replaces once, preserving writable metadata, and returns the canonical list only after refresh', async () => {
        const writeReceived = Promise.withResolvers<void>()
        const release = Promise.withResolvers<void>()
        const { options, writes, reads } = await setup({
            trackedEntityLists: [
                { ...confirmed, id: 'OtherList01' },
                confirmed,
            ],
            respondToWrite: async () => {
                writeReceived.resolve()
                await release.promise
            },
        })

        const result = persistSavedList(options)
        try {
            await Promise.race([
                writeReceived.promise,
                result.then(() => {
                    throw new Error('Persistence completed before the write')
                }),
            ])
            expect(reads).toEqual([])
        } finally {
            release.resolve()
        }

        await expect(result).resolves.toMatchObject({
            id: confirmed.id,
            raw: confirmed,
            configuration,
        })
        expect([...reads].sort()).toEqual([
            'programStageWorkingLists',
            'trackedEntityInstanceFilters',
        ])
        expect(writes).toEqual([
            {
                resource: list.resource,
                id: list.id,
                body: expect.objectContaining({
                    name: list.name,
                    sortOrder: raw.sortOrder,
                    publicAccess: raw.publicAccess,
                    userAccesses: raw.userAccesses,
                    entityQueryCriteria: expect.objectContaining({
                        order: 'createdAt:desc',
                        displayColumnOrder: configuration.columns,
                        futureCriteria: true,
                    }),
                }),
            },
        ])
    })

    it('persists an incompatible list as a repair to the event resource', async () => {
        const { options, writes } = await setup({
            trackedEntityLists: [],
            eventLists: [confirmedEvent],
        })

        await expect(
            persistSavedList({
                ...options,
                list: eventList,
                configuration: repaired,
                operation: 'repairSelectedSavedList',
            })
        ).resolves.toMatchObject({
            id: confirmedEvent.id,
            resource: eventList.resource,
            compatibility: 'compatible',
            configuration: repaired,
        })
        expect(writes).toEqual([
            {
                resource: eventList.resource,
                id: list.id,
                body: expect.objectContaining({
                    programStage: eventRaw.programStage,
                    programStageQueryCriteria: expect.objectContaining({
                        order: 'createdAt:desc',
                    }),
                }),
            },
        ])
    })

    it('accepts equivalent configuration regardless of object key ordering', async () => {
        const reordered: WorkingListConfiguration = {
            filters: [],
            sort: { direction: 'desc', fieldId: 'createdAt' },
            columns: ['createdAt'],
            programId: configuration.programId,
            mode: 'trackedEntity',
        }
        expect(internalConfigurationFingerprint(reordered)).toBe(
            internalConfigurationFingerprint(configuration)
        )

        const { options } = await setup()
        await expect(
            persistSavedList({ ...options, configuration: reordered })
        ).resolves.toMatchObject({
            id: confirmed.id,
            configuration,
        })
    })

    it.each([
        ['updateSelectedView', 'Updated', 'configuration'],
        ['repairSelectedSavedList', 'Repaired', 'repair'],
    ] as const)(
        'preserves the %s error when canonical refresh omits the saved list',
        async (operation, verb, submitted) => {
            const { options } = await setup({
                trackedEntityLists: [{ ...confirmed, id: 'OtherList01' }],
            })

            await expect(
                persistSavedList({ ...options, operation })
            ).rejects.toMatchObject({
                _tag: 'WorkingListInvalidResponseError',
                operation,
                message: `${verb} saved list ${list.id} did not match the submitted ${submitted} after canonical refresh`,
            })
        }
    )

    it('rejects a canonical list that is still incompatible', async () => {
        const { options } = await setup({
            trackedEntityLists: [
                {
                    ...confirmed,
                    entityQueryCriteria: {
                        ...confirmed.entityQueryCriteria,
                        displayColumnOrder: ['RemovedCol1'],
                    },
                },
            ],
        })

        await expect(persistSavedList(options)).rejects.toBeInstanceOf(
            WorkingListInvalidResponseError
        )
    })

    it.each([
        [
            'columns',
            {
                trackedEntityLists: [
                    {
                        ...confirmed,
                        entityQueryCriteria: {
                            ...confirmed.entityQueryCriteria,
                            displayColumnOrder: ['createdAt', 'programOwner'],
                        },
                    },
                ],
            },
        ],
        ['sort', { trackedEntityLists: [raw] }],
        [
            'program',
            {
                programId: 'OtherProg01',
                trackedEntityLists: [
                    { ...confirmed, program: { id: 'OtherProg01' } },
                ],
            },
        ],
        ['mode', { trackedEntityLists: [], eventLists: [confirmedEvent] }],
    ] as const satisfies ReadonlyArray<
        readonly [string, Parameters<typeof setup>[0]]
    >)('rejects a different canonical %s', async (_difference, responses) => {
        const { options } = await setup(responses)

        await expect(persistSavedList(options)).rejects.toBeInstanceOf(
            WorkingListInvalidResponseError
        )
    })

    it('does not write or refresh when replacement would change resource type', async () => {
        const { options, writes, reads } = await setup()

        await expect(
            persistSavedList({
                ...options,
                configuration: repaired,
            })
        ).rejects.toThrow('Cannot replace trackedEntityInstanceFilters')
        expect(writes).toEqual([])
        expect(reads).toEqual([])
    })

    it('leaves mutation failures for the caller to normalize without refreshing', async () => {
        const { options, writes, reads } = await setup({
            writeResponse: Response.json(
                { message: 'Write failed' },
                { status: 503 }
            ),
        })

        await expect(persistSavedList(options)).rejects.toMatchObject({
            details: { message: 'Write failed' },
        })
        expect(writes).toHaveLength(1)
        expect(reads).toEqual([])
    })

    it('does not refresh after a malformed mutation response', async () => {
        const { options, writes, reads } = await setup({
            writeResponse: Response.json({ status: 'ERROR' }),
        })

        await expect(persistSavedList(options)).rejects.toBeInstanceOf(ZodError)
        expect(writes).toHaveLength(1)
        expect(reads).toEqual([])
    })

    it('leaves canonical-refresh failures for the caller to normalize without rewriting', async () => {
        const { options, writes, reads } = await setup({
            readResponse: Response.json(
                { message: 'Refresh failed' },
                { status: 503 }
            ),
        })

        await expect(persistSavedList(options)).rejects.toMatchObject({
            details: { message: 'Refresh failed' },
        })
        expect(writes).toHaveLength(1)
        expect([...reads].sort()).toEqual([
            'programStageWorkingLists',
            'trackedEntityInstanceFilters',
        ])
    })
})
