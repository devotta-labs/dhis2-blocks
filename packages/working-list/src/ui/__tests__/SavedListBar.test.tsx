import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListSavedView } from '../../provider/contracts'
import { SavedListBar } from '../SavedListBar'
import { WorkingListTextProvider } from '../WorkingListText'

const generatedList: WorkingListSavedView = {
    id: 'active',
    name: 'Active enrollments',
    generated: true,
    compatible: true,
    canUpdate: false,
    canDelete: false,
    canShare: false,
}

const ownedList: WorkingListSavedView = {
    ...generatedList,
    id: 'OwnedList01',
    name: 'My working list',
    generated: false,
    canUpdate: true,
    canDelete: true,
    canShare: true,
}

const readOnlyList: WorkingListSavedView = {
    ...generatedList,
    id: 'ReadOnly01',
    name: 'Shared with me',
    generated: false,
}

interface RenderBarOptions {
    lists?: WorkingListSavedView[]
    selectedId?: string
    dirty?: boolean
    online?: boolean
    busy?: boolean
}

describe('SavedListBar', () => {
    const actEnvironment = globalThis
    let originalActEnvironment: boolean | undefined
    let originalRequestAnimationFrame: typeof window.requestAnimationFrame
    let originalCancelAnimationFrame: typeof window.cancelAnimationFrame

    beforeEach(() => {
        originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        originalRequestAnimationFrame = window.requestAnimationFrame
        originalCancelAnimationFrame = window.cancelAnimationFrame
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        window.requestAnimationFrame = (callback) => {
            callback(0)
            return 1
        }
        window.cancelAnimationFrame = () => undefined
    })

    afterEach(() => {
        window.requestAnimationFrame = originalRequestAnimationFrame
        window.cancelAnimationFrame = originalCancelAnimationFrame
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
    })

    const renderBar = (options: RenderBarOptions = {}) => {
        const lists = options.lists ?? [generatedList]
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const callbacks = {
            onSelect: jest.fn(),
            onUpdate: jest.fn(),
            onShare: jest.fn(),
            onDelete: jest.fn(),
        }

        act(() => {
            root.render(
                <WorkingListTextProvider
                    translate={(message, values) =>
                        Object.entries(values ?? {}).reduce(
                            (translated, [key, value]) =>
                                translated.replace(`{{${key}}}`, String(value)),
                            message
                        )
                    }
                >
                    <SavedListBar
                        lists={lists}
                        selectedId={options.selectedId}
                        dirty={options.dirty ?? false}
                        online={options.online ?? true}
                        busy={options.busy ?? false}
                        {...callbacks}
                    />
                </WorkingListTextProvider>
            )
        })

        return {
            callbacks,
            container,
            cleanup: () => {
                act(() => root.unmount())
                container.remove()
            },
        }
    }

    const openMenu = (container: HTMLElement, listId: string) => {
        const trigger = container.querySelector<HTMLButtonElement>(
            `[data-testid="working-list-view-${listId}-menu"]`
        )
        act(() => trigger?.click())
        return trigger
    }

    const menuItem = (dataTest: string) =>
        document.querySelector<HTMLElement>(
            `[data-test="${dataTest}"] [role="menuitem"]`
        )

    it('leaves section naming to its parent and keeps selection separate from view actions', () => {
        const { callbacks, container, cleanup } = renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
        })

        try {
            const bar = container.querySelector<HTMLElement>(
                '[data-testid="saved-list-bar"]'
            )
            const view = container.querySelector<HTMLElement>(
                '[data-testid="working-list-view-OwnedList01"]'
            )
            const selectButton = view?.querySelector<HTMLButtonElement>(
                'button:not([data-saved-view-menu])'
            )
            const menuButton = view?.querySelector<HTMLButtonElement>(
                'button[data-saved-view-menu]'
            )

            expect(bar?.tagName).toBe('DIV')
            expect(bar?.hasAttribute('aria-label')).toBe(false)
            expect(bar?.textContent).not.toContain(
                'Saved views in this program'
            )
            expect(selectButton?.getAttribute('aria-current')).toBe('true')
            expect(menuButton?.querySelector('svg')).not.toBeNull()
            expect(view?.children).toHaveLength(2)

            act(() => selectButton?.click())
            expect(callbacks.onSelect).toHaveBeenCalledWith(ownedList)

            openMenu(container, ownedList.id)
            expect(callbacks.onSelect).toHaveBeenCalledTimes(1)
            expect(menuItem('share-saved-view')).not.toBeNull()
            expect(menuItem('delete-saved-view')).not.toBeNull()
            expect(menuItem('update-saved-view')).toBeNull()
        } finally {
            cleanup()
        }
    })

    it('preserves the accessible dirty marker and offers updating only for the selected view', () => {
        const { container, cleanup } = renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
        })

        try {
            const indicator = container.querySelector<HTMLElement>(
                '[data-testid="working-list-view-OwnedList01"] [data-testid="working-list-dirty-indicator"]'
            )
            expect(indicator?.textContent).toBe('*')
            expect(indicator?.getAttribute('aria-hidden')).toBe('true')
            expect(
                container.querySelector(
                    '[data-testid="working-list-dirty-label"]'
                )?.textContent
            ).toBe('Unsaved changes')

            openMenu(container, ownedList.id)
            expect(menuItem('update-saved-view')?.textContent).toContain(
                'Save changes to this view'
            )
            expect(menuItem('share-saved-view')?.textContent).toContain(
                'Manage sharing'
            )
            expect(menuItem('delete-saved-view')?.textContent).toContain(
                'Delete view'
            )
        } finally {
            cleanup()
        }
    })

    it('calls the update and sharing callbacks for their menu actions', () => {
        const { callbacks, container, cleanup } = renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
        })

        try {
            openMenu(container, ownedList.id)
            act(() => menuItem('update-saved-view')?.click())
            expect(callbacks.onUpdate).toHaveBeenCalledWith(ownedList)

            openMenu(container, ownedList.id)
            act(() => menuItem('share-saved-view')?.click())
            expect(callbacks.onShare).toHaveBeenCalledWith(ownedList)
        } finally {
            cleanup()
        }
    })

    it('requires confirmation before deleting a view', () => {
        const { callbacks, container, cleanup } = renderBar({
            lists: [ownedList],
        })

        try {
            openMenu(container, ownedList.id)
            act(() => menuItem('delete-saved-view')?.click())

            expect(callbacks.onDelete).not.toHaveBeenCalled()
            expect(document.body.textContent).toContain('Delete view?')
            expect(document.body.textContent).toContain(
                '“My working list” will be permanently deleted.'
            )

            const confirm = document.querySelector<HTMLButtonElement>(
                '[data-test="delete-saved-view-confirm"]'
            )
            act(() => confirm?.click())
            expect(callbacks.onDelete).toHaveBeenCalledWith(ownedList)
        } finally {
            cleanup()
        }
    })

    it('does not expose mutation menus for generated or read-only views', () => {
        const generated = renderBar({
            lists: [generatedList],
            selectedId: generatedList.id,
            dirty: true,
        })

        try {
            expect(
                generated.container.querySelector('[data-saved-view-menu]')
            ).toBeNull()
        } finally {
            generated.cleanup()
        }

        const readOnly = renderBar({ lists: [readOnlyList] })
        try {
            expect(
                readOnly.container.querySelector('[data-saved-view-menu]')
            ).toBeNull()
        } finally {
            readOnly.cleanup()
        }
    })

    it('keeps permitted actions visible but disabled while offline', () => {
        const { container, cleanup } = renderBar({
            lists: [ownedList],
            selectedId: ownedList.id,
            dirty: true,
            online: false,
        })

        try {
            openMenu(container, ownedList.id)
            for (const dataTest of [
                'update-saved-view',
                'share-saved-view',
                'delete-saved-view',
            ]) {
                expect(menuItem(dataTest)?.getAttribute('aria-disabled')).toBe(
                    'true'
                )
            }
        } finally {
            cleanup()
        }
    })
})
