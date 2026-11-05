/* oxlint-disable anti-slop/no-module-mocking -- Only host runtime hooks and the external DHIS2 sharing dialog are substituted; queries, provider, state and block UI are real. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import type { DataEngineMutation, DataEngineQuery } from '../api/client'
import { TrackedEntityInstanceFilterSchema } from '../api/schemas'
import type { WorkingListPagination } from './contracts'
import { WorkingListTable } from '../ui/Results'
import { WorkingListSavedViews } from '../ui/SavedViews/WorkingListSavedViews'
import { WorkingListProvider } from './WorkingListProvider'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from './WorkingListContext'
import type {
    WorkingListActions,
    WorkingListMeta,
    WorkingListState,
} from './contracts'

const { runtime } = vi.hoisted(() => ({
    runtime: { online: true, engine: { query: vi.fn(), mutate: vi.fn() } },
}))
vi.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ apiVersion: 43 }),
    useOnlineStatus: () => ({ online: runtime.online }),
    useDataEngine: () => runtime.engine,
}))
vi.mock('@dhis2/ui', async (importOriginal) => ({
    ...(await importOriginal()),
    SharingDialog: ({ onSave }: { onSave: () => void }) => (
        <button onClick={onSave}>Save sharing</button>
    ),
}))

const programId = 'Program0001'
const attributeId = 'Attribute01'
const saved = (id: string, columns = [attributeId]) =>
    TrackedEntityInstanceFilterSchema.parse({
        id,
        displayName: id,
        program: { id: programId },
        access: {
            read: true,
            write: true,
            update: true,
            delete: true,
            manage: true,
        },
        entityQueryCriteria: {
            displayColumnOrder: columns,
            order: 'createdAt:desc',
        },
    })

const deferred = () => {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

const setup = async (initialId = 'SavedList01', stale = false) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })
    let lists = [
        saved('SavedList01', stale ? ['MissingFld1'] : [attributeId]),
        saved('SavedList02'),
    ]
    const failed = new Set<string>()
    let mutationGate: ReturnType<typeof deferred> | undefined
    let confirmWrites = true
    const query = vi.fn(async (definitions: DataEngineQuery) => {
        const request = definitions.workingListResource
        if (failed.has(request.resource))
            return { workingListResource: { malformed: true } }
        switch (request.resource) {
            case 'system/info':
                return {
                    workingListResource: {
                        calendar: 'gregorian',
                        dateFormat: 'YYYY-MM-DD',
                        serverTimeZoneId: 'UTC',
                    },
                }
            case 'programs':
                return {
                    workingListResource: {
                        id: programId,
                        displayName: 'Program',
                        programType: 'WITH_REGISTRATION',
                        programTrackedEntityAttributes: [
                            {
                                displayInList: true,
                                trackedEntityAttribute: {
                                    id: attributeId,
                                    displayName: 'Name',
                                    valueType: 'TEXT',
                                },
                            },
                        ],
                        programStages: [
                            {
                                id: 'Stage000001',
                                displayName: 'Stage',
                                programStageDataElements: [],
                            },
                        ],
                    },
                }
            case 'trackedEntityInstanceFilters':
                return {
                    workingListResource: {
                        trackedEntityInstanceFilters: lists,
                    },
                }
            case 'programStageWorkingLists':
                return { workingListResource: { programStageWorkingLists: [] } }
            case 'tracker/events':
                return { workingListResource: { events: [] } }
            case 'tracker/trackedEntities':
                return {
                    workingListResource: {
                        trackedEntities: [
                            {
                                trackedEntity: 'Entity00001',
                                createdAt: '2026-01-01T00:00:00',
                                attributes: [
                                    { attribute: attributeId, value: 'Ada' },
                                ],
                                programOwners: [
                                    {
                                        orgUnit: 'OrgUnit0001',
                                        program: programId,
                                    },
                                ],
                            },
                        ],
                        pager: {
                            page: request.params?.page,
                            pageSize: request.params?.pageSize,
                        },
                    },
                }
            case 'organisationUnits':
                return {
                    workingListResource: {
                        organisationUnits: [
                            { id: 'OrgUnit0001', displayName: 'Clinic' },
                        ],
                    },
                }
            default:
                throw new Error(`Unexpected request ${request.resource}`)
        }
    })
    const mutate = vi.fn(async (mutation: DataEngineMutation) => {
        await mutationGate?.promise
        if (confirmWrites) {
            if (mutation.type === 'delete')
                lists = lists.filter(({ id }) => id !== mutation.id)
            else
                lists = lists.map((list) =>
                    list.id === mutation.id
                        ? TrackedEntityInstanceFilterSchema.parse({
                              ...list,
                              ...TrackedEntityInstanceFilterSchema.partial().parse(
                                  mutation.data
                              ),
                          })
                        : list
                )
        }
        return mutation.type === 'delete' ? undefined : { status: 'OK' }
    })
    runtime.engine = { query, mutate }
    runtime.online = true
    let meta: WorkingListMeta | undefined
    let state: WorkingListState | undefined
    let actions: WorkingListActions | undefined
    const observedActions: WorkingListActions[] = []
    const StateProbe = () => {
        state = useWorkingListState((value) => value)
        return null
    }
    const Probe = () => {
        meta = useWorkingListMeta((value) => value)
        actions = useWorkingListActions()
        observedActions.push(actions)
        return meta.activeConfiguration.status === 'ready' ? (
            <StateProbe />
        ) : null
    }
    const Harness = () => {
        const [selection, setSelection] = useState(initialId)
        const [pagination, setPagination] = useState<WorkingListPagination>({
            page: 1,
            pageSize: 15,
        })
        return (
            <QueryClientProvider client={client}>
                <WorkingListProvider
                    programId={programId}
                    orgUnitId="OrgUnit0001"
                    selectedSavedListId={selection}
                    onSelectedSavedListChange={setSelection}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                >
                    <Probe />
                    <WorkingListSavedViews />
                    <WorkingListTable dataQualityMode="highlighted" />
                </WorkingListProvider>
            </QueryClientProvider>
        )
    }
    const screen = await render(<Harness />)
    const current = () => {
        if (!meta || !actions) throw new Error('Provider did not render')
        return { meta, actions, state }
    }
    await vi.waitFor(() =>
        expect(current().meta.lifecycle.status).toBe('ready')
    )
    await vi.waitFor(() =>
        expect(current().meta.savedViews.status).toBe('ready')
    )
    const requests = (resource: string) =>
        query.mock.calls.filter(
            ([definitions]) =>
                definitions.workingListResource.resource === resource
        ).length
    return {
        screen,
        client,
        current,
        requests,
        query,
        mutate,
        failed,
        observedActions,
        setOnline: async (online: boolean) => {
            runtime.online = online
            await screen.rerender(<Harness />)
        },
        pauseMutation: () => {
            mutationGate = deferred()
            return mutationGate
        },
        ignoreWrites: () => {
            confirmWrites = false
        },
        changeSharing: () => {
            lists = lists.map((list) => ({
                ...list,
                access: { ...list.access, update: false },
            }))
        },
        dispose: async () => {
            await screen.unmount()
            client.clear()
        },
    }
}

describe('ready WorkingList provider boundaries', () => {
    it('stages controlled pagination, resets it on stage change and rejects cross-resource writes', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        expect(h.current().actions.setPage(2).isOk()).toBe(true)
        await vi.waitFor(() =>
            expect(h.current().meta.results).toMatchObject({
                status: 'ready',
                pagination: { page: 2 },
            })
        )
        expect(
            h.query.mock.calls.some(
                ([definitions]) =>
                    definitions.workingListResource.params?.page === 2
            )
        ).toBe(true)
        expect(h.current().actions.setProgramStage('Stage000001').isOk()).toBe(
            true
        )
        await vi.waitFor(() =>
            expect(h.current().state?.configuration.mode).toBe('event')
        )
        expect(h.current().meta.pagination.page).toBe(1)
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe(
            'InvalidConfigurationError'
        )
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('retains cached rows offline and rejects mutations before reaching the engine', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        await h.setOnline(false)
        await vi.waitFor(() => expect(h.current().meta.online).toBe(false))
        h.failed.add('tracker/trackedEntities')
        await h.client.invalidateQueries({
            predicate: ({ queryKey }) => queryKey.includes('records'),
        })
        expect(h.current().meta.results.status).toBe('ready')
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .toBeVisible()
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe('OfflineMutationError')
        expect(
            (await h.current().actions.deleteView('SavedList01')).isErr()
        ).toBe(true)
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('loads results, retains stable actions, and keeps column order/dirty/save behind canonical confirmation', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        await expect
            .element(h.screen.getByRole('cell', { name: 'Ada', exact: true }))
            .toBeVisible()
        expect(h.current().actions.setColumns([]).isErr()).toBe(true)
        expect(h.current().actions.setColumns(['__dataQuality']).isErr()).toBe(
            true
        )
        expect(
            h
                .current()
                .actions.setColumns(['programOwnerId', attributeId])
                .isOk()
        ).toBe(true)
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        const result = await h.current().actions.updateSelectedView()
        expect(result.isOk()).toBe(true)
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(false))
        expect(h.current().state?.configuration.columns).toEqual([
            'programOwnerId',
            attributeId,
        ])
        expect(h.mutate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    entityQueryCriteria: expect.objectContaining({
                        displayColumnOrder: ['programOwner', attributeId],
                    }),
                }),
            })
        )
        expect(new Set(h.observedActions).size).toBe(1)
        await h.dispose()
    })

    it('result retry reloads both the page and failed OU labels', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.failed.add('organisationUnits')
        await h.client.resetQueries({
            predicate: ({ queryKey }) =>
                queryKey.includes('organisation-units'),
        })
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('error')
        )
        const pages = h.requests('tracker/trackedEntities')
        const labels = h.requests('organisationUnits')
        h.failed.clear()
        await h.screen
            .getByTestId('results-error')
            .getByRole('button', { name: 'Try again' })
            .click()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        expect(h.requests('tracker/trackedEntities')).toBeGreaterThan(pages)
        expect(h.requests('organisationUnits')).toBeGreaterThan(labels)
        await h.dispose()
    })

    it('keeps cached views usable beside error/retry and refreshes canonical sharing', async () => {
        const h = await setup()
        h.failed.add('trackedEntityInstanceFilters')
        await h.client.invalidateQueries({
            predicate: ({ queryKey }) => queryKey.includes('saved-lists'),
        })
        await vi.waitFor(() =>
            expect(h.current().meta.savedViews.status).toBe('error')
        )
        await expect
            .element(h.screen.getByTestId('saved-list-bar'))
            .toBeVisible()
        await expect
            .element(h.screen.getByTestId('saved-working-lists-error'))
            .toBeVisible()
        await h.screen
            .getByRole('button', { name: 'SavedList02', exact: true })
            .click()
        await vi.waitFor(() =>
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        )
        h.failed.clear()
        await h.screen
            .getByTestId('saved-working-lists-error')
            .getByRole('button', { name: 'Try again' })
            .click()
        await vi.waitFor(() =>
            expect(h.current().meta.savedViews.status).toBe('ready')
        )
        h.changeSharing()
        const before = h.requests('trackedEntityInstanceFilters')
        await h.screen.getByTestId('working-list-view-SavedList02-menu').click()
        await h.screen.getByRole('menuitem', { name: 'Manage sharing' }).click()
        await h.screen.getByRole('button', { name: 'Save sharing' }).click()
        await vi.waitFor(() =>
            expect(
                h
                    .current()
                    .meta.savedViews.views.find(
                        ({ id }) => id === 'SavedList02'
                    )?.canUpdate
            ).toBe(false)
        )
        expect(h.requests('trackedEntityInstanceFilters')).toBeGreaterThan(
            before
        )
        expect((await h.current().actions.updateSelectedView()).isErr()).toBe(
            true
        )
        expect(h.mutate).not.toHaveBeenCalled()
        await h.dispose()
    })

    it('never marks edited configuration clean after a delayed update', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.current().actions.setColumns(['programOwnerId', attributeId])
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        const gate = h.pauseMutation()
        const updating = h.current().actions.updateSelectedView()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        h.current().actions.setColumns(['createdAt', attributeId])
        gate.resolve()
        expect((await updating).isOk()).toBe(true)
        await vi.waitFor(() =>
            expect(h.current().meta.mutations.update.status).toBe('idle')
        )
        expect(h.current().state?.configuration.columns).toEqual([
            'createdAt',
            attributeId,
        ])
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })

    it.each(['update', 'delete'] as const)(
        'does not change selection after delayed %s of another view',
        async (operation) => {
            const h = await setup()
            await vi.waitFor(() =>
                expect(h.current().meta.results.status).toBe('ready')
            )
            const gate = h.pauseMutation()
            const mutation =
                operation === 'update'
                    ? h.current().actions.updateSelectedView()
                    : h.current().actions.deleteView('SavedList01')
            await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
            h.current().actions.selectView('SavedList02')
            await vi.waitFor(() =>
                expect(h.current().state?.selectedSavedListId).toBe(
                    'SavedList02'
                )
            )
            h.current().actions.setColumns(['createdAt', attributeId])
            gate.resolve()
            expect((await mutation).isOk()).toBe(true)
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
            expect(h.current().state?.configuration.columns).toEqual([
                'createdAt',
                attributeId,
            ])
            expect(h.current().meta.dirty).toBe(true)
            await h.dispose()
        }
    )

    it('confirms a current repair through canonical refresh before making it ready', async () => {
        const h = await setup('SavedList01', true)
        await vi.waitFor(() =>
            expect(h.current().meta.selection.status).toBe('error')
        )
        const gate = h.pauseMutation()
        await h.screen
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await h.screen
            .getByRole('dialog')
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        expect(h.current().meta.selection.status).toBe('error')
        gate.resolve()
        await vi.waitFor(() =>
            expect(h.current().meta.selection).toEqual({
                status: 'ready',
                selectedSavedListId: 'SavedList01',
            })
        )
        expect(h.current().state?.configuration.columns).toEqual([attributeId])
        expect(h.current().meta.dirty).toBe(false)
        await h.dispose()
    })

    it('repairs through the rendered dialog without stealing a later selection', async () => {
        const h = await setup('SavedList01', true)
        await vi.waitFor(() =>
            expect(h.current().meta.selection.status).toBe('error')
        )
        const gate = h.pauseMutation()
        await h.screen
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await expect
            .element(
                h.screen.getByRole('cell', {
                    name: 'MissingFld1 (Unknown)',
                    exact: true,
                })
            )
            .toBeVisible()
        await expect
            .element(
                h.screen.getByRole('cell', {
                    name: 'Replace with default',
                    exact: true,
                })
            )
            .toBeVisible()
        await h.screen
            .getByRole('dialog')
            .getByRole('button', { name: 'Repair', exact: true })
            .click()
        await vi.waitFor(() => expect(h.mutate).toHaveBeenCalledTimes(1))
        h.current().actions.selectView('SavedList02')
        await vi.waitFor(() =>
            expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        )
        h.current().actions.setColumns(['createdAt', attributeId])
        gate.resolve()
        await vi.waitFor(() =>
            expect(
                h
                    .current()
                    .meta.savedViews.views.find(
                        ({ id }) => id === 'SavedList01'
                    )?.compatible
            ).toBe(true)
        )
        expect(h.current().state?.selectedSavedListId).toBe('SavedList02')
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })

    it('rejects HTTP success without a matching canonical saved configuration', async () => {
        const h = await setup()
        await vi.waitFor(() =>
            expect(h.current().meta.results.status).toBe('ready')
        )
        h.current().actions.setColumns(['createdAt', attributeId])
        await vi.waitFor(() => expect(h.current().meta.dirty).toBe(true))
        h.ignoreWrites()
        const result = await h.current().actions.updateSelectedView()
        expect(result.isErr() && result.error._tag).toBe(
            'WorkingListInvalidResponseError'
        )
        expect(h.current().meta.dirty).toBe(true)
        await h.dispose()
    })
})
