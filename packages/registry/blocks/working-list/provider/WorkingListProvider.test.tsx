import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import { TestRuntime } from '../__tests__/testEngine'
import {
    useWorkingList,
    type WorkingListContextValue,
} from './WorkingListContext'
import {
    WorkingListProvider,
    type WorkingListProviderProps,
} from './WorkingListProvider'

/** A server that never answers, so every query stays pending. */
const silent = () => new Promise<never>(() => undefined)

const Runtime = ({
    queryClient,
    children,
}: {
    queryClient: QueryClient
    children: ReactNode
}) => (
    <TestRuntime data={{ 'system/info': silent }}>
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    </TestRuntime>
)

/** Renders the provider and keeps what `useWorkingList()` last returned. */
const setup = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const observed: WorkingListContextValue[] = []
    const Probe = () => {
        observed.push(useWorkingList())
        return null
    }
    const element = (props: Omit<WorkingListProviderProps, 'children'>) => (
        <Runtime queryClient={queryClient}>
            <WorkingListProvider {...props}>
                <Probe />
            </WorkingListProvider>
        </Runtime>
    )
    const latest = () => {
        const value = observed.at(-1)
        if (!value) throw new Error('The provider has not rendered')
        return value
    }
    return { element, latest, queryClient }
}

describe('WorkingListProvider controlled selection', () => {
    it('opens on the page it is given and returns to page 1 when the organisation unit or view changes', async () => {
        const { element, latest, queryClient } = setup()
        const viewChange = vi.fn()
        const paginationChange = vi.fn()
        const props = {
            programId: 'Program0001',
            orgUnitId: 'OrgUnit00001',
            viewId: 'SavedList01',
            onViewChange: viewChange,
            pagination: { page: 3, pageSize: 15 },
            onPaginationChange: paginationChange,
        } satisfies Omit<WorkingListProviderProps, 'children'>

        const screen = await render(element(props))
        expect(latest().viewId).toBe('SavedList01')
        expect(latest().pagination).toEqual({ page: 3, pageSize: 15 })
        // A deep-linked page is left alone on mount.
        expect(paginationChange).not.toHaveBeenCalled()

        await screen.rerender(element({ ...props, orgUnitId: 'OrgUnit00002' }))
        await vi.waitFor(() => {
            expect(paginationChange).toHaveBeenCalledWith({
                page: 1,
                pageSize: 15,
            })
        })

        paginationChange.mockClear()
        await screen.rerender(
            element({
                ...props,
                orgUnitId: 'OrgUnit00002',
                viewId: 'SavedList02',
            })
        )
        expect(latest().viewId).toBe('SavedList02')
        await vi.waitFor(() => {
            expect(paginationChange).toHaveBeenCalledWith({
                page: 1,
                pageSize: 15,
            })
        })
        expect(viewChange).not.toHaveBeenCalled()

        queryClient.clear()
    })

    it('reports a selection to the handler it was last given', async () => {
        const { element, latest, queryClient } = setup()
        const firstViewChange = vi.fn()
        const secondViewChange = vi.fn()
        const props = {
            programId: 'Program0001',
            orgUnitId: 'OrgUnit00001',
            viewId: 'SavedList01',
            pagination: { page: 1, pageSize: 15 },
            onPaginationChange: vi.fn(),
        } satisfies Omit<WorkingListProviderProps, 'children'>

        const screen = await render(
            element({ ...props, onViewChange: firstViewChange })
        )
        await screen.rerender(
            element({ ...props, onViewChange: secondViewChange })
        )

        latest().selectView('SavedList03')
        expect(firstViewChange).not.toHaveBeenCalled()
        expect(secondViewChange).toHaveBeenCalledWith('SavedList03')
        // The view is the owner's to change: nothing moves until it does.
        expect(latest().viewId).toBe('SavedList01')

        queryClient.clear()
    })

    it.each([
        ['null', null],
        ['an empty string', ''],
    ])('uses the generated default for %s', async (_label, viewId) => {
        const { element, latest, queryClient } = setup()
        const viewChange = vi.fn()
        const paginationChange = vi.fn()

        await render(
            element({
                programId: 'Program0001',
                orgUnitId: 'OrgUnit00001',
                viewId,
                onViewChange: viewChange,
                pagination: { page: 3, pageSize: 15 },
                onPaginationChange: paginationChange,
            })
        )

        expect(latest().viewId).toBe('Program0001-default')
        expect(viewChange).not.toHaveBeenCalled()
        expect(paginationChange).not.toHaveBeenCalled()

        queryClient.clear()
    })
})

describe('WorkingListProvider keeping its own state', () => {
    it('starts on the default page and view, and turns to page 1 with a new view', async () => {
        const { element, latest, queryClient } = setup()
        const viewChange = vi.fn()
        const paginationChange = vi.fn()

        await render(
            element({
                programId: 'Program0001',
                orgUnitId: 'OrgUnit00001',
                defaultViewId: 'SavedList01',
                onViewChange: viewChange,
                defaultPagination: { page: 4, pageSize: 50 },
                onPaginationChange: paginationChange,
            })
        )
        expect(latest().viewId).toBe('SavedList01')
        expect(latest().pagination).toEqual({ page: 4, pageSize: 50 })

        latest().selectView('SavedList02')
        await vi.waitFor(() => {
            expect(latest().viewId).toBe('SavedList02')
            expect(latest().pagination).toEqual({ page: 1, pageSize: 50 })
        })
        expect(viewChange).toHaveBeenCalledWith('SavedList02')
        expect(paginationChange).toHaveBeenCalledWith({ page: 1, pageSize: 50 })

        latest().setPagination({ page: 2, pageSize: 50 })
        await vi.waitFor(() => {
            expect(latest().pagination).toEqual({ page: 2, pageSize: 50 })
        })

        queryClient.clear()
    })
})
