import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListSavedView } from '../../provider/contracts'
import { ConfigureMenu } from '../ConfigureMenu'
import { WorkingListTextProvider } from '../WorkingListText'

const ownedList: WorkingListSavedView = {
    id: 'OwnedList01',
    name: 'My working list',
    generated: false,
    compatible: true,
    canUpdate: true,
    canDelete: true,
    canShare: true,
}

const renderMenu = ({
    selectedView,
    dirty = false,
    online = true,
}: {
    selectedView?: WorkingListSavedView
    dirty?: boolean
    online?: boolean
}) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onDownload = jest.fn()
    const onSaveAs = jest.fn(async () => undefined)
    const onUpdate = jest.fn()

    act(() => {
        root.render(
            <WorkingListTextProvider translate={(message) => message}>
                <ConfigureMenu
                    selectedView={selectedView}
                    dirty={dirty}
                    online={online}
                    busy={false}
                    createPending={false}
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

    it('offers create and download for an unfiltered default view', () => {
        const { container, onDownload, cleanup } = renderMenu({})
        try {
            expect(
                container.querySelector('[data-test="save-working-list"]')
            ).not.toBeNull()
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

    it('keeps create and download together for a generated view', () => {
        const { container, cleanup } = renderMenu({})
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
            selectedView: ownedList,
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
            expect(onUpdate).toHaveBeenCalledWith()
        } finally {
            cleanup()
        }
    })

    it('does not send an update when the selected view is clean', () => {
        const { container, onUpdate, cleanup } = renderMenu({
            selectedView: ownedList,
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
