import React from 'react'
import { render } from 'vitest-browser-react'
import { page } from 'vitest/browser'
import {
    createFakeServer,
    FakeServerRuntime,
    savedTrackedEntityList,
} from '../__tests__/fakeServer'
import {
    WorkingList,
    WorkingListTable,
    WorkingListViewSwitcher,
} from '../ui/WorkingList'
import {
    useCreateSavedList,
    useDeleteSavedList,
    useUpdateSavedList,
} from './mutations'
import { useWorkingList } from './WorkingListContext'

const savedListReads = (server: ReturnType<typeof createFakeServer>) =>
    server.reads.filter(
        ({ resource }) => resource === 'trackedEntityInstanceFilters'
    ).length

interface ListHooks {
    list?: ReturnType<typeof useWorkingList>
    create?: ReturnType<typeof useCreateSavedList>
    update?: ReturnType<typeof useUpdateSavedList>
    remove?: ReturnType<typeof useDeleteSavedList>
}

/** A list as rendered in an app, with its mutation hooks handed to the test. */
const renderList = async (
    server: ReturnType<typeof createFakeServer>,
    defaultViewId?: string
) => {
    const hooks: ListHooks = {}
    const Probe = () => {
        const list = useWorkingList()
        const create = useCreateSavedList()
        const update = useUpdateSavedList()
        const remove = useDeleteSavedList()
        Object.assign(hooks, { list, create, update, remove })
        return null
    }
    const onViewChange = vi.fn()
    const screen = await render(
        <FakeServerRuntime server={server}>
            <WorkingList
                programId="Program0001"
                orgUnitId="OrgUnit0001"
                defaultViewId={defaultViewId}
                onViewChange={onViewChange}
            >
                <WorkingListViewSwitcher />
                <WorkingListTable />
                <Probe />
            </WorkingList>
        </FakeServerRuntime>
    )
    return { screen, hooks, onViewChange }
}

describe('saved-list mutation hooks', () => {
    it('creates a list from the configuration on screen, reloads the lists and selects it', async () => {
        const server = createFakeServer()
        const { screen, hooks, onViewChange } = await renderList(server)
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        const readsBefore = savedListReads(server)

        await hooks.create?.mutateAsync('  Mine  ')

        expect(server.writes).toEqual([
            expect.objectContaining({
                type: 'create',
                resource: 'trackedEntityInstanceFilters',
                data: expect.objectContaining({
                    name: 'Mine',
                    program: { id: 'Program0001' },
                }),
            }),
        ])
        expect(savedListReads(server)).toBe(readsBefore + 1)
        expect(onViewChange).toHaveBeenLastCalledWith('Created0001')
        await expect
            .element(screen.getByTestId('working-list-view-Created0001'))
            .toBeVisible()
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
    })

    it('rejects a blank name without writing', async () => {
        const server = createFakeServer()
        const { screen, hooks } = await renderList(server)
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()

        await expect(hooks.create?.mutateAsync('   ')).rejects.toMatchObject({
            _tag: 'InvalidConfigurationError',
        })
        expect(server.writes).toEqual([])
    })

    it('replaces the selected list once, keeping what the block does not own, and leaves it clean', async () => {
        const server = createFakeServer({
            trackedEntityLists: [
                {
                    ...savedTrackedEntityList('SavedList01', 'My list', {
                        order: 'createdAt:asc',
                        displayColumnOrder: ['Attribute01'],
                        futureCriteria: true,
                    }),
                    sortOrder: 7,
                    userAccesses: [{ id: 'User0000001', access: 'rw------' }],
                },
            ],
        })
        const { screen, hooks } = await renderList(server, 'SavedList01')
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()

        hooks.list?.setDraft({
            mode: 'trackedEntity',
            columns: ['Attribute01'],
            sort: { fieldId: 'createdAt', direction: 'desc' },
            filters: [],
        })
        await expect
            .element(screen.getByTestId('working-list-dirty-indicator'))
            .toBeVisible()
        const readsBefore = savedListReads(server)

        await hooks.update?.mutateAsync()

        expect(server.writes).toEqual([
            expect.objectContaining({
                type: 'replace',
                resource: 'trackedEntityInstanceFilters',
                id: 'SavedList01',
                data: expect.objectContaining({
                    name: 'My list',
                    sortOrder: 7,
                    publicAccess: '--------',
                    userAccesses: [{ id: 'User0000001', access: 'rw------' }],
                    entityQueryCriteria: expect.objectContaining({
                        order: 'createdAt:desc',
                        displayColumnOrder: ['Attribute01'],
                        futureCriteria: true,
                    }),
                }),
            }),
        ])
        expect(savedListReads(server)).toBe(readsBefore + 1)
        await expect
            .element(screen.getByTestId('working-list-dirty-indicator'))
            .not.toBeInTheDocument()
    })

    it('refuses to update a list the user may not change', async () => {
        const server = createFakeServer({
            trackedEntityLists: [
                {
                    ...savedTrackedEntityList('SavedList01', 'My list'),
                    access: { read: true, update: false, write: false },
                },
            ],
        })
        const { screen, hooks } = await renderList(server, 'SavedList01')
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()

        await expect(hooks.update?.mutateAsync()).rejects.toMatchObject({
            _tag: 'SavedListPermissionError',
        })
        expect(server.writes).toEqual([])
    })

    it('refuses to update the default list, which is not saved anywhere', async () => {
        const server = createFakeServer()
        const { screen, hooks } = await renderList(server)
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()

        await expect(hooks.update?.mutateAsync()).rejects.toMatchObject({
            _tag: 'NoSelectedSavedListError',
        })
        expect(server.writes).toEqual([])
    })

    it('reports a write the server refused, without reloading the lists', async () => {
        const server = createFakeServer({
            trackedEntityLists: [
                savedTrackedEntityList('SavedList01', 'My list'),
            ],
            answerWrite: () => Promise.reject(new Error('Connection lost')),
        })
        const { screen, hooks } = await renderList(server, 'SavedList01')
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        const readsBefore = savedListReads(server)

        await expect(hooks.update?.mutateAsync()).rejects.toMatchObject({
            _tag: 'WorkingListNetworkError',
        })
        expect(server.writes).toHaveLength(1)
        expect(savedListReads(server)).toBe(readsBefore)
    })

    it('reports a write answer it cannot read, without reloading the lists', async () => {
        const server = createFakeServer({
            trackedEntityLists: [
                savedTrackedEntityList('SavedList01', 'My list'),
            ],
            answerWrite: () => ({ status: 'ERROR' }),
        })
        const { screen, hooks } = await renderList(server, 'SavedList01')
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        const readsBefore = savedListReads(server)

        await expect(hooks.update?.mutateAsync()).rejects.toMatchObject({
            _tag: 'WorkingListInvalidResponseError',
        })
        expect(savedListReads(server)).toBe(readsBefore)
    })

    it('deletes the selected list and returns to the default list', async () => {
        const server = createFakeServer({
            trackedEntityLists: [
                savedTrackedEntityList('SavedList01', 'My list'),
                savedTrackedEntityList('SavedList02', 'Other list'),
            ],
        })
        const { screen, hooks, onViewChange } = await renderList(
            server,
            'SavedList01'
        )
        await expect
            .element(screen.getByTestId('working-list-view-SavedList01'))
            .toBeVisible()

        await hooks.remove?.mutateAsync('SavedList01')

        expect(server.writes).toEqual([
            expect.objectContaining({
                type: 'delete',
                resource: 'trackedEntityInstanceFilters',
                id: 'SavedList01',
            }),
        ])
        expect(onViewChange).toHaveBeenLastCalledWith('Program0001-default')
        await expect
            .element(screen.getByTestId('working-list-view-SavedList01'))
            .not.toBeInTheDocument()
        await expect
            .element(screen.getByTestId('working-list-view-SavedList02'))
            .toBeVisible()
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
    })

    it('refuses to delete a list that is not among the saved lists', async () => {
        const server = createFakeServer()
        const { screen, hooks } = await renderList(server)
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()

        await expect(
            hooks.remove?.mutateAsync('Missing0001')
        ).rejects.toMatchObject({ _tag: 'SavedListNotFoundError' })
        expect(server.writes).toEqual([])
    })
})

describe('repairing an incompatible saved list', () => {
    const staleEventList = {
        ...savedTrackedEntityList('EventList01', 'Visits'),
        entityQueryCriteria: undefined,
        programStage: { id: 'ProgStage01' },
        programStageQueryCriteria: {
            order: 'createdAt:desc',
            displayColumnOrder: ['Attribute01', 'RemovedDE01'],
        },
    }

    it('writes the repaired list to its own resource and then shows it', async () => {
        const { entityQueryCriteria: _unused, ...eventList } = staleEventList
        const server = createFakeServer({ eventLists: [eventList] })
        const { screen } = await renderList(server, 'EventList01')
        await screen.getByRole('button', { name: 'Repair' }).click()
        // The dialog renders outside the list, over the page.
        await page
            .getByRole('dialog')
            .getByRole('button', { name: 'Repair' })
            .click()

        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        expect(server.writes).toEqual([
            expect.objectContaining({
                type: 'replace',
                resource: 'programStageWorkingLists',
                id: 'EventList01',
                data: expect.objectContaining({
                    name: 'Visits',
                    programStage: { id: 'ProgStage01' },
                    // The removed column goes; the one that was fine is
                    // kept once, not written again in its place.
                    programStageQueryCriteria: expect.objectContaining({
                        displayColumnOrder: ['Attribute01'],
                    }),
                }),
            }),
        ])
    })

    it('offers no repair when the repaired list would belong to the other resource', async () => {
        const { entityQueryCriteria: _unused, ...eventList } = staleEventList
        const server = createFakeServer({
            eventLists: [{ ...eventList, programStage: { id: 'GoneStage01' } }],
        })
        const { screen } = await renderList(server, 'EventList01')

        await expect
            .element(screen.getByTestId('stale-list-panel'))
            .toBeVisible()
        await expect
            .element(screen.getByRole('button', { name: 'Repair' }))
            .not.toBeInTheDocument()
        expect(server.writes).toEqual([])
    })
})
