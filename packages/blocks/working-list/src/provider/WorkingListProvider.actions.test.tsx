/* oxlint-disable anti-slop/no-module-mocking -- Provider integration tests replace the host runtime, the saved-list API and the lifecycle boundary. */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Result } from 'better-result'
import React, { useState } from 'react'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../api/capabilities'
import type { ProgramFieldCatalog } from '../api/metadata'
import {
    createDefaultWorkingList,
    defaultWorkingListId,
    type NormalizedSavedWorkingList,
} from '../api/savedLists'
import type { WorkingListField } from '../domain/model'
import type {
    AppliedFilter,
    WorkingListActions,
    WorkingListSelectionMeta,
    WorkingListState,
} from './contracts'
import {
    useWorkingListActions,
    useWorkingListMeta,
    useWorkingListState,
} from './WorkingListContext'
import { WorkingListProvider } from './WorkingListProvider'

const {
    mockEngine,
    mockUseQuery,
    mockCreateSavedWorkingList,
    mockFetchSavedWorkingLists,
    mockLifecycle,
    mockState,
} = vi.hoisted(() => {
    const pendingQuery = {
        data: undefined,
        error: null,
        isError: false,
        isFetching: false,
        isPending: true,
        isSuccess: false,
        refetch: vi.fn(),
    }

    return {
        mockEngine: {
            query: vi.fn(),
            mutate: vi.fn(),
        },
        mockUseQuery: vi.fn(),
        mockCreateSavedWorkingList: vi.fn(),
        mockFetchSavedWorkingLists: vi.fn(),
        mockLifecycle: { current: {} },
        mockState: {
            // SAFETY: the test swaps the saved-list set per case; it starts empty.
            lists: [] as NormalizedSavedWorkingList[],
            pendingQuery,
        },
    }
})

vi.mock('@dhis2/app-runtime', () => ({
    useConfig: () => ({ apiVersion: 43 }),
    useDataEngine: () => mockEngine,
    useOnlineStatus: () => ({ online: true }),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => ({
    ...(await importOriginal()),
    useQuery: (...args: unknown[]) => mockUseQuery(...args),
}))

vi.mock('../api/savedLists', async (importOriginal) => ({
    ...(await importOriginal()),
    createSavedWorkingList: (...args: unknown[]) =>
        mockCreateSavedWorkingList(...args),
    fetchSavedWorkingLists: (...args: unknown[]) =>
        mockFetchSavedWorkingLists(...args),
}))

vi.mock('./useWorkingListLifecycle', () => ({
    useWorkingListLifecycle: () => mockLifecycle.current,
}))

const nameField = {
    id: 'Attribute01',
    displayName: 'Name',
    source: 'trackedEntityAttribute' as const,
    scope: 'trackedEntity' as const,
    valueType: 'TEXT' as const,
    filterable: true,
}

const ownerField = {
    id: 'Attribute02',
    displayName: 'Owner',
    source: 'trackedEntityAttribute' as const,
    scope: 'trackedEntity' as const,
    valueType: 'TEXT' as const,
    filterable: true,
}

const createdAtField = {
    id: 'createdAt',
    displayName: 'Registration date',
    source: 'system' as const,
    scope: 'trackedEntity' as const,
    valueType: 'DATETIME' as const,
    filterable: false,
}

const metadata: ProgramFieldCatalog = {
    fields: new Map<string, WorkingListField>([
        [nameField.id, nameField],
        [ownerField.id, ownerField],
        [createdAtField.id, createdAtField],
    ]),
    fieldsByProgramStage: new Map(),
    capabilities: resolveWorkingListCapabilities({ apiVersion: 43 }),
    defaultTrackedEntityColumns: [nameField.id],
    defaultEventColumnsByStage: new Map(),
    readableProgramStageIds: new Set(),
}

const programId = 'Program0001'

const defaultListId = defaultWorkingListId(programId)

const defaultList = createDefaultWorkingList({
    programId,
    columns: [nameField.id],
})

const savedList = (id: string, columns: string[]) => ({
    ...createDefaultWorkingList({ programId, columns }),
    id,
    name: id,
})

const listA = savedList('SavedList01', [nameField.id])

const listB = savedList('SavedList02', [nameField.id])

const createdList = savedList('SavedList99', [nameField.id])

const nameFilter: AppliedFilter = {
    fieldId: nameField.id,
    operator: 'like',
    value: { kind: 'text', value: 'Ada' },
}

const readyLifecycle = {
    online: true,
    translate: (message: string) => message,
    locale: 'en',
    program: undefined,
    systemInfo: undefined,
    capabilities: metadata.capabilities,
    metadata,
    parsingContext: undefined,
    serializationContext: undefined,
    calendarContext: undefined,
    defaultList,
    generatedLists: [],
    defaultListId,
    lifecycle: { status: 'ready' },
    lifecycleReady: true,
}

describe('WorkingListProvider actions', () => {
    beforeEach(() => {
        mockLifecycle.current = readyLifecycle
        mockState.lists = [listA, listB]
        mockFetchSavedWorkingLists.mockImplementation(
            async () => mockState.lists
        )
        mockUseQuery.mockImplementation(
            (options: { queryKey?: readonly unknown[] }) => {
                const queryKey = options.queryKey

                if (
                    queryKey?.[0] === 'working-list' &&
                    queryKey?.[1] === 'saved-lists'
                ) {
                    return {
                        data: mockState.lists,
                        error: null,
                        isError: false,
                        isFetching: false,
                        isPending: false,
                        isSuccess: true,
                        refetch: vi.fn(),
                    }
                }

                return mockState.pendingQuery
            }
        )
    })

    const renderProvider = async () => {
        const queryClient = new QueryClient({
            defaultOptions: { queries: { retry: false } },
        })

        const selectionChange = vi.fn()
        const paginationChange = vi.fn()
        const observedActions: WorkingListActions[] = []
        const observedStates: (WorkingListState | undefined)[] = []
        const observedSelections: WorkingListSelectionMeta[] = []
        const observedDirty: boolean[] = []

        const Probe = () => {
            observedActions.push(useWorkingListActions())
            observedStates.push(useWorkingListState((state) => state))
            observedSelections.push(
                useWorkingListMeta((meta) => meta.selection)
            )
            observedDirty.push(useWorkingListMeta((meta) => meta.dirty))

            return null
        }

        const Host = () => {
            const [selectedId, setSelectedId] = useState(listA.id)

            return (
                <QueryClientProvider client={queryClient}>
                    <WorkingListProvider
                        programId={programId}
                        orgUnitId="OrgUnit00001"
                        selectedSavedListId={selectedId}
                        onSelectedSavedListChange={(id) => {
                            selectionChange(id)
                            setSelectedId(id)
                        }}
                        pagination={{ page: 1, pageSize: 15 }}
                        onPaginationChange={paginationChange}
                    >
                        <Probe />
                    </WorkingListProvider>
                </QueryClientProvider>
            )
        }

        await render(<Host />)

        return {
            selectionChange,
            paginationChange,
            observedActions,
            observedStates,
            observedSelections,
            observedDirty,
            queryClient,
        }
    }

    it('composes back-to-back configuration commands within one event', async () => {
        const { observedActions, observedStates, observedDirty, queryClient } =
            await renderProvider()

        const actions = observedActions.at(-1)

        expect(observedStates.at(-1)?.selectedSavedListId).toBe(listA.id)

        // The second command must compose on the draft the first one just
        // committed, before React has rendered it.
        expect(actions?.setFilter(nameFilter).isOk()).toBe(true)
        expect(actions?.setColumns([nameField.id, ownerField.id]).isOk()).toBe(
            true
        )

        await vi.waitFor(() => {
            const state = observedStates.at(-1)
            expect(state?.configuration.filters).toEqual([nameFilter])
            expect(state?.configuration.columns).toEqual([
                nameField.id,
                ownerField.id,
            ])
        })
        expect(observedDirty.at(-1)).toBe(true)

        queryClient.clear()
    })

    it('does not reselect the created view after a selection round trip', async () => {
        const {
            observedActions,
            observedSelections,
            observedDirty,
            selectionChange,
            queryClient,
        } = await renderProvider()

        const actions = observedActions.at(-1)

        let resolveCreate!: (id: string) => void
        mockCreateSavedWorkingList.mockImplementation(
            () =>
                new Promise<string>((resolve) => {
                    resolveCreate = resolve
                })
        )

        const createPromise = actions?.createView('New view')

        // The user leaves A and returns before the create request settles.
        actions?.selectView(listB.id)
        await vi.waitFor(() => {
            expect(observedSelections.at(-1)).toEqual({
                status: 'ready',
                selectedSavedListId: listB.id,
            })
        })
        actions?.selectView(listA.id)
        await vi.waitFor(() => {
            expect(observedSelections.at(-1)).toEqual({
                status: 'ready',
                selectedSavedListId: listA.id,
            })
        })
        expect(actions?.setFilter(nameFilter).isOk()).toBe(true)
        await vi.waitFor(() => {
            expect(observedDirty.at(-1)).toBe(true)
        })

        mockState.lists = [listA, listB, createdList]
        resolveCreate(createdList.id)

        const createResult = await createPromise
        expect(createResult && Result.isOk(createResult)).toBe(true)

        // The completed create must not steal the user's selection or draft.
        expect(selectionChange).not.toHaveBeenCalledWith(createdList.id)
        expect(observedSelections.at(-1)).toEqual({
            status: 'ready',
            selectedSavedListId: listA.id,
        })
        expect(observedDirty.at(-1)).toBe(true)

        queryClient.clear()
    })
})
