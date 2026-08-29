/* oxlint-disable anti-slop/no-module-mocking -- The root contract is tested by replacing its already-covered provider and lifecycle container boundaries. */
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListPagination } from '../../provider/contracts'

interface ObservedProviderProps {
    programId: string
    orgUnitId: string
    selectedSavedListId: string | null
    pagination: WorkingListPagination
    onSelectedSavedListChange(id: string): void
    onPaginationChange(next: WorkingListPagination): void
}

const { observedProviders } = vi.hoisted(() => ({
    // SAFETY: Every entry is written by the typed provider mock below.
    observedProviders: [] as ObservedProviderProps[],
}))

vi.mock('../../provider/WorkingListProvider', () => ({
    WorkingListProvider: (
        props: ObservedProviderProps & { children: React.ReactNode }
    ) => {
        observedProviders.push(props)
        return <>{props.children}</>
    },
}))

vi.mock('../Container', () => ({
    WorkingListContainer: ({
        children,
        ...props
    }: React.ComponentPropsWithoutRef<'article'>) => (
        <article {...props}>{children}</article>
    ),
}))

import { WorkingList } from '../WorkingList'

// SAFETY: React documents this global as the test-environment switch used by act().
const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT: boolean
}

describe('WorkingList root state', () => {
    beforeAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    })

    beforeEach(() => observedProviders.splice(0))

    it('provides independent uncontrolled view and pagination defaults with notifications', () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const firstViewChange = vi.fn()
        const secondViewChange = vi.fn()
        const firstPaginationChange = vi.fn()

        act(() => {
            root.render(
                <>
                    <WorkingList
                        key="primary-list"
                        programId="Program0001"
                        orgUnitId="OrgUnit00001"
                        defaultViewId="View0000001"
                        onViewChange={firstViewChange}
                        defaultPagination={{ page: 2, pageSize: 25 }}
                        onPaginationChange={firstPaginationChange}
                    >
                        <span>First</span>
                    </WorkingList>
                    <WorkingList
                        key="secondary-list"
                        programId="Program0001"
                        orgUnitId="OrgUnit00002"
                        onViewChange={secondViewChange}
                    >
                        <span>Second</span>
                    </WorkingList>
                </>
            )
        })

        const first = observedProviders.find(
            (provider) => provider.orgUnitId === 'OrgUnit00001'
        )
        const second = observedProviders.find(
            (provider) => provider.orgUnitId === 'OrgUnit00002'
        )
        expect(first?.selectedSavedListId).toBe('View0000001')
        expect(first?.pagination).toEqual({ page: 2, pageSize: 25 })
        expect(second?.selectedSavedListId).toBeNull()
        expect(second?.pagination).toEqual({ page: 1, pageSize: 10 })

        act(() => first?.onSelectedSavedListChange('View0000003'))
        act(() => first?.onPaginationChange({ page: 3, pageSize: 50 }))

        const updatedFirst = observedProviders
            .filter((provider) => provider.orgUnitId === 'OrgUnit00001')
            .at(-1)
        const updatedSecond = observedProviders
            .filter((provider) => provider.orgUnitId === 'OrgUnit00002')
            .at(-1)
        expect(updatedFirst?.selectedSavedListId).toBe('View0000003')
        expect(updatedFirst?.pagination).toEqual({ page: 3, pageSize: 50 })
        expect(updatedSecond?.selectedSavedListId).toBeNull()
        expect(firstViewChange).toHaveBeenCalledWith('View0000003')
        expect(firstPaginationChange).toHaveBeenCalledWith({
            page: 3,
            pageSize: 50,
        })
        expect(secondViewChange).not.toHaveBeenCalled()

        act(() => root.unmount())
    })

    it('uses a caller-provided React key to replace a same-program instance', () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const renderInstance = (key: string) => (
            <WorkingList
                key={key}
                programId="Program0001"
                orgUnitId="OrgUnit00001"
                defaultViewId="DefaultView"
                defaultPagination={{ page: 2, pageSize: 25 }}
            >
                <span>Content</span>
            </WorkingList>
        )

        act(() => root.render(renderInstance('first-instance')))
        const first = observedProviders.at(-1)
        act(() => first?.onSelectedSavedListChange('ChangedView'))
        act(() => first?.onPaginationChange({ page: 5, pageSize: 50 }))

        expect(observedProviders.at(-1)?.selectedSavedListId).toBe(
            'ChangedView'
        )
        expect(observedProviders.at(-1)?.pagination).toEqual({
            page: 5,
            pageSize: 50,
        })

        act(() => root.render(renderInstance('second-instance')))

        expect(observedProviders.at(-1)?.selectedSavedListId).toBe(
            'DefaultView'
        )
        expect(observedProviders.at(-1)?.pagination).toEqual({
            page: 2,
            pageSize: 25,
        })

        act(() => root.unmount())
    })

    it('keeps controlled values authoritative', () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const onViewChange = vi.fn()
        const onPaginationChange = vi.fn()

        act(() => {
            root.render(
                <WorkingList
                    programId="Program0001"
                    orgUnitId="OrgUnit00001"
                    viewId="Controlled01"
                    onViewChange={onViewChange}
                    pagination={{ page: 4, pageSize: 25 }}
                    onPaginationChange={onPaginationChange}
                >
                    <span>Controlled</span>
                </WorkingList>
            )
        })

        const controlled = observedProviders.find(
            (provider) => provider.programId === 'Program0001'
        )
        act(() => controlled?.onSelectedSavedListChange('Controlled02'))
        act(() => controlled?.onPaginationChange({ page: 5, pageSize: 50 }))

        expect(onViewChange).toHaveBeenCalledWith('Controlled02')
        expect(onPaginationChange).toHaveBeenCalledWith({
            page: 5,
            pageSize: 50,
        })
        expect(controlled?.selectedSavedListId).toBe('Controlled01')
        expect(controlled?.pagination).toEqual({ page: 4, pageSize: 25 })

        act(() => root.unmount())
    })

    it('resets uncontrolled state when the program changes and forwards root props', () => {
        const container = document.createElement('div')
        const root = createRoot(container)
        const renderProgram = (programId: string) => (
            <WorkingList
                programId={programId}
                orgUnitId="OrgUnit00001"
                defaultViewId="DefaultView"
                defaultPagination={{ page: 2, pageSize: 25 }}
                className="consumer-root"
                aria-label="People worklist"
                data-consumer="forwarded"
            >
                <span>Content</span>
            </WorkingList>
        )

        act(() => root.render(renderProgram('Program0001')))
        const first = observedProviders.at(-1)
        act(() => first?.onSelectedSavedListChange('ChangedView'))
        act(() => first?.onPaginationChange({ page: 5, pageSize: 50 }))
        act(() => root.render(renderProgram('Program0002')))

        const second = observedProviders.at(-1)
        expect(second?.selectedSavedListId).toBe('DefaultView')
        expect(second?.pagination).toEqual({ page: 2, pageSize: 25 })
        const article = container.querySelector('article')
        expect(article?.className).toBe('consumer-root')
        expect(article?.getAttribute('aria-label')).toBe('People worklist')
        expect(article?.getAttribute('data-consumer')).toBe('forwarded')

        act(() => root.unmount())
    })

    it('throws descriptive errors for invalid controlled runtime props', () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        const viewContainer = document.createElement('div')
        const viewRoot = createRoot(viewContainer)
        const paginationContainer = document.createElement('div')
        const paginationRoot = createRoot(paginationContainer)

        expect(() => {
            act(() => {
                viewRoot.render(
                    // @ts-expect-error This intentionally exercises the JavaScript runtime guard for a missing controlled callback.
                    <WorkingList
                        programId="Program0001"
                        orgUnitId="OrgUnit00001"
                        viewId="View00000001"
                    >
                        <span>Invalid view</span>
                    </WorkingList>
                )
            })
        }).toThrow(
            'WorkingList requires onViewChange when viewId is controlled.'
        )

        expect(() => {
            act(() => {
                paginationRoot.render(
                    // @ts-expect-error This intentionally exercises the JavaScript runtime guard for a missing controlled callback.
                    <WorkingList
                        programId="Program0001"
                        orgUnitId="OrgUnit00001"
                        pagination={{ page: 2, pageSize: 15 }}
                    >
                        <span>Invalid pagination</span>
                    </WorkingList>
                )
            })
        }).toThrow(
            'WorkingList requires onPaginationChange when pagination is controlled.'
        )
        consoleError.mockRestore()
    })
})
