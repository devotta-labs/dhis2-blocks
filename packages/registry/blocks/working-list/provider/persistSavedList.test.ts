import { resolveWorkingListCapabilities } from '../api/capabilities'
import { createWorkingListClient, type DataEngineMutation } from '../api/client'
import type { ProgramFieldCatalog } from '../api/metadata'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import type { WorkingListConfiguration } from '../domain/model'
import { systemColumnFields } from '../registry/systemFilters'
import { WorkingListInvalidResponseError } from './errors'
import { persistSavedList } from './persistSavedList'

const capabilities = resolveWorkingListCapabilities({ apiVersion: 43 })
const metadata: ProgramFieldCatalog = {
    fields: new Map(systemColumnFields.map((field) => [field.id, field])),
    fieldsByProgramStage: new Map(),
    capabilities,
    defaultTrackedEntityColumns: ['createdAt'],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set(),
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

const setup = () => {
    const mutate = vi.fn(async (_mutation: DataEngineMutation) => ({
        status: 'OK',
    }))
    const query = vi.fn(async () => ({ workingListResource: raw }))
    const confirmed: NormalizedSavedWorkingList = {
        ...list,
        compatibility: 'compatible',
        configuration,
    }
    const refreshSavedLists = vi.fn(
        async (): Promise<NormalizedSavedWorkingList[]> => [confirmed]
    )
    const options = {
        client: createWorkingListClient({ mutate, query }),
        list,
        configuration,
        metadata,
        capabilities,
        refreshSavedLists,
        operation: 'updateSelectedView' as const,
    }

    return { mutate, query, confirmed, refreshSavedLists, options }
}

describe('persistSavedList', () => {
    it('replaces once, preserving writable metadata, and returns the canonical list only after refresh', async () => {
        const { options, mutate, query, confirmed, refreshSavedLists } = setup()
        mutate.mockImplementationOnce(async () => {
            await Promise.resolve()
            expect(refreshSavedLists).not.toHaveBeenCalled()
            return { status: 'OK' }
        })
        refreshSavedLists.mockImplementationOnce(async () => {
            expect(mutate).toHaveBeenCalledTimes(1)
            return [{ ...confirmed, id: 'OtherList01' }, confirmed]
        })

        expect(await persistSavedList(options)).toBe(confirmed)
        expect(refreshSavedLists).toHaveBeenCalledTimes(1)
        expect(query).not.toHaveBeenCalled()
        expect(mutate).toHaveBeenCalledExactlyOnceWith({
            resource: list.resource,
            id: list.id,
            type: 'replace',
            data: expect.objectContaining({
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
        })
    })

    it('persists an incompatible list as a repair to the event resource', async () => {
        const { options, confirmed, mutate, refreshSavedLists } = setup()
        const repaired: WorkingListConfiguration = {
            ...configuration,
            mode: 'event',
            programStageId: 'ProgStage01',
        }
        const eventRaw = {
            ...raw,
            programStage: { id: repaired.programStageId },
            programStageQueryCriteria: { order: 'createdAt:asc' },
        }
        const eventList: NormalizedSavedWorkingList = {
            ...list,
            resource: 'programStageWorkingLists',
            compatibility: 'incompatible',
            raw: eventRaw,
            issues: [],
        }
        const canonical: NormalizedSavedWorkingList = {
            ...confirmed,
            resource: eventList.resource,
            compatibility: 'compatible',
            configuration: repaired,
        }
        refreshSavedLists.mockResolvedValueOnce([canonical])

        expect(
            await persistSavedList({
                ...options,
                list: eventList,
                configuration: repaired,
                operation: 'repairSelectedSavedList',
            })
        ).toBe(canonical)
        expect(mutate).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                resource: eventList.resource,
                id: list.id,
                type: 'replace',
                data: expect.objectContaining({
                    programStage: eventRaw.programStage,
                    programStageQueryCriteria: expect.objectContaining({
                        order: 'createdAt:desc',
                    }),
                }),
            })
        )
    })

    it('accepts equivalent configuration regardless of object key ordering', async () => {
        const { options, confirmed, refreshSavedLists } = setup()
        const canonical: NormalizedSavedWorkingList = {
            ...confirmed,
            compatibility: 'compatible',
            configuration: {
                filters: [],
                sort: { direction: 'desc', fieldId: 'createdAt' },
                columns: ['createdAt'],
                programId: configuration.programId,
                mode: 'trackedEntity',
            },
        }
        refreshSavedLists.mockResolvedValueOnce([canonical])

        expect(await persistSavedList(options)).toBe(canonical)
    })

    it.each([
        ['updateSelectedView', 'Updated', 'configuration'],
        ['repairSelectedSavedList', 'Repaired', 'repair'],
    ] as const)(
        'preserves the %s error when canonical refresh omits the saved list',
        async (operation, verb, submitted) => {
            const { options, confirmed, refreshSavedLists } = setup()
            refreshSavedLists.mockResolvedValueOnce([
                { ...confirmed, id: 'OtherList01' },
            ])

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
        const { options, refreshSavedLists } = setup()
        refreshSavedLists.mockResolvedValueOnce([
            { ...list, compatibility: 'incompatible', raw, issues: [] },
        ])

        await expect(persistSavedList(options)).rejects.toBeInstanceOf(
            WorkingListInvalidResponseError
        )
    })

    it.each<WorkingListConfiguration>([
        { ...configuration, columns: ['createdAt', 'updatedAt'] },
        { ...configuration, sort: { fieldId: 'createdAt', direction: 'asc' } },
        { ...configuration, programId: 'OtherProg01' },
        { ...configuration, mode: 'event', programStageId: 'ProgStage01' },
    ])('rejects a different canonical configuration: %j', async (different) => {
        const { options, confirmed, refreshSavedLists } = setup()
        refreshSavedLists.mockResolvedValueOnce([
            {
                ...confirmed,
                compatibility: 'compatible',
                configuration: different,
            },
        ])

        await expect(persistSavedList(options)).rejects.toBeInstanceOf(
            WorkingListInvalidResponseError
        )
    })

    it('does not write or refresh when replacement would change resource type', async () => {
        const { options, mutate, refreshSavedLists } = setup()

        await expect(
            persistSavedList({
                ...options,
                configuration: {
                    ...configuration,
                    mode: 'event',
                    programStageId: 'ProgStage01',
                },
            })
        ).rejects.toThrow('Cannot replace trackedEntityInstanceFilters')
        expect(mutate).not.toHaveBeenCalled()
        expect(refreshSavedLists).not.toHaveBeenCalled()
    })

    it('leaves mutation failures for the caller to normalize without refreshing', async () => {
        const { options, mutate, refreshSavedLists } = setup()
        const failure = new Error('Write failed')
        mutate.mockRejectedValueOnce(failure)

        await expect(persistSavedList(options)).rejects.toBe(failure)
        expect(refreshSavedLists).not.toHaveBeenCalled()
    })

    it('does not refresh after a malformed mutation response', async () => {
        const { options, mutate, refreshSavedLists } = setup()
        mutate.mockResolvedValueOnce({ status: 'ERROR' })

        await expect(persistSavedList(options)).rejects.toThrow()
        expect(refreshSavedLists).not.toHaveBeenCalled()
    })

    it('leaves canonical-refresh failures for the caller to normalize without rewriting', async () => {
        const { options, mutate, refreshSavedLists } = setup()
        const failure = new Error('Refresh failed')
        refreshSavedLists.mockRejectedValueOnce(failure)

        await expect(persistSavedList(options)).rejects.toBe(failure)
        expect(mutate).toHaveBeenCalledTimes(1)
        expect(refreshSavedLists).toHaveBeenCalledTimes(1)
    })
})
