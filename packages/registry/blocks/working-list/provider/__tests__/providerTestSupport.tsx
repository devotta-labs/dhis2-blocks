/* oxlint-disable anti-slop/no-module-mocking -- Only host runtime hooks and the external DHIS2 sharing dialog are substituted; queries, provider, state and block UI are real. */
import {
    notifyManager,
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import React, { act, useState } from 'react'
import { render } from 'vitest-browser-react'
import type { DataEngineMutation, DataEngineQuery } from '../../api/client'
import { TrackedEntityInstanceFilterSchema } from '../../api/schemas'
import type { WorkingListPagination } from '../contracts'
import { WorkingListFilterControls } from '../../ui/Filters'
import { WorkingListTable } from '../../ui/Results'
import { WorkingListSavedViews } from '../../ui/SavedViews/WorkingListSavedViews'
import { WorkingListProvider } from '../WorkingListProvider'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from '../WorkingListContext'
import type {
    WorkingListActions,
    WorkingListMeta,
    WorkingListState,
} from '../contracts'

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
export const attributeId = 'Attribute01'
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

export const setup = async (initialId = 'SavedList01', stale = false) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })
    let lists = [
        saved('SavedList01', stale ? ['MissingFld1'] : [attributeId]),
        saved('SavedList02'),
    ]
    const failed = new Set<string>()
    let mutationGate: ReturnType<typeof deferred> | undefined
    let recordsGate: ReturnType<typeof deferred> | undefined
    let selectedOrgUnit = 'OrgUnit0001'
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
                await recordsGate?.promise
                return {
                    workingListResource: {
                        trackedEntities: [
                            {
                                trackedEntity:
                                    request.params?.orgUnits === 'OrgUnit0002'
                                        ? 'Entity00002'
                                        : 'Entity00001',
                                createdAt: '2026-01-01T00:00:00',
                                attributes: [
                                    {
                                        attribute: attributeId,
                                        value:
                                            request.params?.orgUnits ===
                                            'OrgUnit0002'
                                                ? 'Grace'
                                                : 'Ada',
                                    },
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
                    orgUnitId={selectedOrgUnit}
                    selectedSavedListId={selection}
                    onSelectedSavedListChange={setSelection}
                    pagination={pagination}
                    onPaginationChange={setPagination}
                >
                    <Probe />
                    <WorkingListSavedViews />
                    <WorkingListFilterControls />
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
        setOrgUnit: async (orgUnit: string) => {
            selectedOrgUnit = orgUnit
            await screen.rerender(<Harness />)
        },
        pauseRecords: () => {
            recordsGate = deferred()
            return recordsGate
        },
        settle: async () => {
            await act(async () => {
                await new Promise<void>((done) => notifyManager.schedule(done))
                await Promise.all(
                    client
                        .getQueryCache()
                        .getAll()
                        .filter(
                            (query) => query.state.fetchStatus === 'fetching'
                        )
                        .map((query) => query.promise)
                )
                await new Promise<void>((done) => notifyManager.schedule(done))
            })
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
