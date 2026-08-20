import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { NormalizedSavedWorkingList } from '../api/savedLists'
import { ConfigureMenu } from './ConfigureMenu'
import { WorkingListTextProvider } from './text'

const generatedList: NormalizedSavedWorkingList = {
    id: 'active',
    name: 'Active enrollments',
    resource: 'trackedEntityInstanceFilters',
    sharing: {},
    compatibility: 'compatible',
    configuration: {
        mode: 'trackedEntity',
        programId: 'Program0001',
        filters: [],
        columns: ['createdAt'],
        sort: { fieldId: 'createdAt', direction: 'desc' },
    },
}

const ownedList: NormalizedSavedWorkingList = {
    ...generatedList,
    id: 'OwnedList01',
    name: 'My working list',
    sharing: {
        access: {
            delete: true,
            manage: true,
            update: true,
            write: true,
        },
    },
}

const renderMenu = (props: {
    list?: NormalizedSavedWorkingList
    selectedIsGenerated?: boolean
    dirty?: boolean
    online?: boolean
}) => {
    const list = props.list ?? generatedList
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
        root.render(
            <WorkingListTextProvider translate={(message) => message}>
                <ConfigureMenu
                    selectedList={list}
                    selectedIsGenerated={props.selectedIsGenerated ?? false}
                    activeResource="trackedEntityInstanceFilters"
                    dirty={props.dirty ?? false}
                    online={props.online ?? true}
                    busy={false}
                    onDelete={() => undefined}
                    onRename={() => undefined}
                    onSaveAs={() => undefined}
                    onSharingSaved={() => undefined}
                    onUpdate={() => undefined}
                    onConfigureColumns={() => undefined}
                />
            </WorkingListTextProvider>
        )
    })

    return {
        container,
        cleanup: () => {
            act(() => root.unmount())
            container.remove()
        },
    }
}

describe('ConfigureMenu', () => {
    const actEnvironment = globalThis as typeof globalThis & {
        IS_REACT_ACT_ENVIRONMENT?: boolean
    }
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

    it('only offers applicable generated-list actions alongside the columns group', () => {
        const { container, cleanup } = renderMenu({
            selectedIsGenerated: true,
        })

        try {
            const options = container.querySelector<HTMLButtonElement>(
                '[data-test="working-list-options"]'
            )
            expect(options?.getAttribute('aria-haspopup')).toBe('menu')

            act(() => options?.click())

            const saveAs = document.querySelector<HTMLElement>(
                '[data-test="save-as-working-list"]'
            )
            expect(saveAs).not.toBeNull()
            expect(document.activeElement).toBe(saveAs)
            expect(
                document.querySelector('[data-test="configure-columns"]')
            ).not.toBeNull()
            expect(
                document.querySelector('[data-test="update-working-list"]')
            ).toBeNull()
            expect(
                document.querySelector('[data-test="rename-working-list"]')
            ).toBeNull()
            expect(
                document.querySelector('[data-test="share-working-list"]')
            ).toBeNull()
            expect(
                document.querySelector('[data-test="delete-working-list"]')
            ).toBeNull()

            act(() => {
                saveAs?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        key: 'Escape',
                        bubbles: true,
                    })
                )
            })
            expect(document.activeElement).toBe(options)
        } finally {
            cleanup()
        }
    })

    it('offers every permitted action for a dirty writable list', () => {
        const { container, cleanup } = renderMenu({
            list: ownedList,
            dirty: true,
        })

        try {
            const options = container.querySelector<HTMLButtonElement>(
                '[data-test="working-list-options"]'
            )
            act(() => options?.click())

            for (const dataTest of [
                'save-as-working-list',
                'update-working-list',
                'rename-working-list',
                'share-working-list',
                'delete-working-list',
                'configure-columns',
            ]) {
                const item = document.querySelector<HTMLElement>(
                    `[data-test="${dataTest}"] [role="menuitem"]`
                )
                expect(item).not.toBeNull()
                expect(item?.getAttribute('aria-disabled')).not.toBe('true')
            }
        } finally {
            cleanup()
        }
    })

    it('disables saved-list actions offline but keeps column configuration available', () => {
        const { container, cleanup } = renderMenu({
            list: ownedList,
            dirty: true,
            online: false,
        })

        try {
            const options = container.querySelector<HTMLButtonElement>(
                '[data-test="working-list-options"]'
            )
            expect(options).not.toBeNull()
            act(() => options?.click())

            for (const dataTest of [
                'save-as-working-list',
                'update-working-list',
                'rename-working-list',
                'share-working-list',
                'delete-working-list',
            ]) {
                const item = document.querySelector<HTMLElement>(
                    `[data-test="${dataTest}"] [role="menuitem"]`
                )
                expect(item).not.toBeNull()
                expect(item?.getAttribute('aria-disabled')).toBe('true')
            }

            const configureColumns = document.querySelector<HTMLElement>(
                '[data-test="configure-columns"] [role="menuitem"]'
            )
            expect(configureColumns).not.toBeNull()
            expect(configureColumns?.getAttribute('aria-disabled')).not.toBe(
                'true'
            )
        } finally {
            cleanup()
        }
    })
})
