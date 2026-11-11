import React from 'react'
import { render } from 'vitest-browser-react'
import {
    createFakeServer,
    FakeServerRuntime,
    savedTrackedEntityList,
} from '../../__tests__/fakeServer'
import type { WorkingListConfiguration } from '../../provider/contracts'
import { useWorkingList } from '../../provider/WorkingListContext'
import { WorkingList, WorkingListTable } from '../WorkingList'

const savedConfiguration: WorkingListConfiguration = {
    mode: 'trackedEntity',
    columns: ['Attribute01'],
    sort: { fieldId: 'createdAt', direction: 'asc' },
    filters: [],
}

const serverWithList = () =>
    createFakeServer({
        trackedEntityLists: [
            savedTrackedEntityList('SavedList01', 'My list', {
                order: 'createdAt:asc',
                displayColumnOrder: ['Attribute01'],
            }),
        ],
    })

const recordPages = (server: ReturnType<typeof createFakeServer>) =>
    server.reads
        .filter(({ resource }) => resource === 'tracker/trackedEntities')
        .map(({ params }) => params?.page)

describe('WorkingList client state', () => {
    it('opens on the page it is given without asking for page 1', async () => {
        const server = serverWithList()
        const onPaginationChange = vi.fn()
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit0001"
                    viewId="SavedList01"
                    onViewChange={vi.fn()}
                    pagination={{ page: 3, pageSize: 15 }}
                    onPaginationChange={onPaginationChange}
                >
                    <WorkingListTable />
                </WorkingList>
            </FakeServerRuntime>
        )

        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        expect(recordPages(server)).toEqual([3])
        expect(onPaginationChange).not.toHaveBeenCalled()
    })

    it('says when the configuration on screen differs from the saved list', async () => {
        const server = serverWithList()
        const onDirtyChange = vi.fn()
        let list: ReturnType<typeof useWorkingList> | undefined
        const Probe = () => {
            list = useWorkingList()
            return null
        }
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit0001"
                    defaultViewId="SavedList01"
                    onDirtyChange={onDirtyChange}
                >
                    <WorkingListTable />
                    <Probe />
                </WorkingList>
            </FakeServerRuntime>
        )
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        expect(onDirtyChange.mock.calls).toEqual([[false]])

        list?.setDraft({
            ...savedConfiguration,
            sort: { fieldId: 'createdAt', direction: 'desc' },
        })
        await vi.waitFor(() => {
            expect(onDirtyChange.mock.calls).toEqual([[false], [true]])
        })

        // Undoing the change by hand leaves nothing to save.
        list?.setDraft(savedConfiguration)
        await vi.waitFor(() => {
            expect(onDirtyChange.mock.calls).toEqual([[false], [true], [false]])
        })
        expect(list?.draft).toBeUndefined()
    })

    it('returns to page 1 when a draft selects different rows', async () => {
        const server = serverWithList()
        let list: ReturnType<typeof useWorkingList> | undefined
        const Probe = () => {
            list = useWorkingList()
            return null
        }
        const screen = await render(
            <FakeServerRuntime server={server}>
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit0001"
                    defaultViewId="SavedList01"
                    defaultPagination={{ page: 2, pageSize: 15 }}
                >
                    <WorkingListTable />
                    <Probe />
                </WorkingList>
            </FakeServerRuntime>
        )
        await expect
            .element(screen.getByTestId('working-list-table'))
            .toBeVisible()
        expect(list?.pagination.page).toBe(2)

        list?.setDraft({
            ...savedConfiguration,
            filters: [
                {
                    fieldId: 'Attribute01',
                    operator: 'like',
                    value: { kind: 'text', value: 'Ada' },
                },
            ],
        })
        await vi.waitFor(() => {
            expect(list?.pagination.page).toBe(1)
        })
        await vi.waitFor(() => {
            expect(recordPages(server)).toEqual([2, 1])
        })
    })
})
