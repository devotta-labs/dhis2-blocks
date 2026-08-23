import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { NormalizedSavedWorkingList } from '../../api/savedLists'
import { ConfigureMenu } from '../ConfigureMenu'
import { WorkingListTextProvider } from '../WorkingListText'

const ownedList: NormalizedSavedWorkingList = {
    id: 'OwnedList01',
    name: 'My working list',
    resource: 'trackedEntityInstanceFilters',
    sharing: {
        access: {
            delete: true,
            manage: true,
            update: true,
            write: true,
        },
    },
    compatibility: 'compatible',
    configuration: {
        mode: 'trackedEntity',
        programId: 'Program0001',
        filters: [],
        columns: ['createdAt'],
        sort: { fieldId: 'createdAt', direction: 'desc' },
    },
}

const renderMenu = ({
    selectedList,
    selectedIsGenerated = false,
    hasFilters = false,
    dirty = false,
    online = true,
}: {
    selectedList?: NormalizedSavedWorkingList
    selectedIsGenerated?: boolean
    hasFilters?: boolean
    dirty?: boolean
    online?: boolean
}) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onDownload = jest.fn()
    const onSaveAs = jest.fn()
    const onUpdate = jest.fn()

    act(() => {
        root.render(
            <WorkingListTextProvider translate={(message) => message}>
                <ConfigureMenu
                    selectedList={selectedList}
                    selectedIsGenerated={selectedIsGenerated}
                    activeResource="trackedEntityInstanceFilters"
                    hasFilters={hasFilters}
                    dirty={dirty}
                    online={online}
                    busy={false}
                    onDownload={onDownload}
                    onSaveAs={onSaveAs}
                    onUpdate={onUpdate}
                />
            </WorkingListTextProvider>
        )
    })

    return {
        container,
        onDownload,
        onUpdate,
        cleanup: () => {
            act(() => root.unmount())
            container.remove()
        },
    }
}

describe('working-list actions', () => {
    const actEnvironment = globalThis
    let originalActEnvironment: boolean | undefined

    beforeEach(() => {
        originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
    })

    afterEach(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    })

    it('shows only More with Download data for an unfiltered default view', () => {
        const { container, onDownload, cleanup } = renderMenu({})
        try {
            expect(
                container.querySelector('[data-test="save-working-list"]')
            ).toBeNull()
            act(() => {
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-test="working-list-options"] button'
                    )
                    ?.click()
            })
            const download = document.querySelector<HTMLElement>(
                '[data-test="download-working-list"] [role="menuitem"]'
            )
            expect(download).not.toBeNull()
            act(() => download?.click())
            expect(onDownload).toHaveBeenCalledTimes(1)
        } finally {
            cleanup()
        }
    })

    it('adds a direct Save view action when filters are applied', () => {
        const { container, cleanup } = renderMenu({ hasFilters: true })
        try {
            expect(
                container.querySelector('[data-test="save-working-list"]')
            ).not.toBeNull()
            expect(
                container.querySelector('[data-test="working-list-options"]')
            ).not.toBeNull()
        } finally {
            cleanup()
        }
    })

    it('shows update and create-new actions for a persisted selection', () => {
        const { container, onUpdate, cleanup } = renderMenu({
            selectedList: ownedList,
            dirty: true,
        })
        try {
            expect(
                container.querySelector('[data-test="working-list-options"]')
            ).toBeNull()
            act(() => {
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-test="save-working-list"] button'
                    )
                    ?.click()
            })
            const update = document.querySelector<HTMLElement>(
                '[data-test="update-working-list"] [role="menuitem"]'
            )
            expect(update).not.toBeNull()
            expect(
                document.querySelector('[data-test="save-as-working-list"]')
            ).not.toBeNull()
            act(() => update?.click())
            expect(onUpdate).toHaveBeenCalledWith(ownedList)
        } finally {
            cleanup()
        }
    })

    it('does not send an update when the selected view is clean', () => {
        const { container, onUpdate, cleanup } = renderMenu({
            selectedList: ownedList,
        })
        try {
            act(() => {
                container
                    .querySelector<HTMLButtonElement>(
                        '[data-test="save-working-list"] button'
                    )
                    ?.click()
            })
            act(() => {
                document
                    .querySelector<HTMLElement>(
                        '[data-test="update-working-list"] [role="menuitem"]'
                    )
                    ?.click()
            })
            expect(onUpdate).not.toHaveBeenCalled()
        } finally {
            cleanup()
        }
    })
})
