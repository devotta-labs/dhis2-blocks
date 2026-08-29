import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { WorkingListField } from '../../domain/model'
import {
    ColumnSettingsDialog,
    getInitialColumnDialogOrder,
    getVisibleColumnIdsInOrder,
} from '../ColumnSettingsDialog'
import { WorkingListTextProvider } from '../WorkingListText'

const fields: WorkingListField[] = ['a', 'b', 'c', 'd'].map((id) => ({
    id,
    displayName: `Column ${id.toUpperCase()}`,
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
}))

const translate = (
    message: string,
    values?: Record<string, string | number | boolean | undefined>
) =>
    Object.entries(values ?? {}).reduce(
        (result, [key, value]) =>
            result.replace(`{{${key}}}`, String(value ?? '')),
        message
    )

const renderDialog = (
    visibleColumnIds: string[],
    onChange = jest.fn(),
    onClose = jest.fn()
) => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    act(() => {
        root.render(
            <WorkingListTextProvider translate={translate}>
                <ColumnSettingsDialog
                    fields={fields}
                    visibleColumnIds={visibleColumnIds}
                    onChange={onChange}
                    onClose={onClose}
                />
            </WorkingListTextProvider>
        )
    })
    return { container, onChange, onClose, root }
}

const cleanUp = (root: Root, container: HTMLElement) => {
    act(() => root.unmount())
    container.remove()
}

describe('column settings dialog', () => {
    const actEnvironment = globalThis
    const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
    const originalCss = globalThis.CSS

    beforeAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        Object.defineProperty(globalThis, 'CSS', {
            configurable: true,
            value: { escape: (value: string) => value },
        })
    })

    afterAll(() => {
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        Object.defineProperty(globalThis, 'CSS', {
            configurable: true,
            value: originalCss,
        })
    })

    it('interleaves hidden columns while retaining saved visible order', () => {
        const ordered = getInitialColumnDialogOrder(fields, ['c', 'a'])
        expect(ordered.map((field) => field.id)).toEqual(['c', 'b', 'a', 'd'])
        expect(getVisibleColumnIdsInOrder(ordered, ['c', 'a'])).toEqual([
            'c',
            'a',
        ])
    })

    it('matches the column configuration labels and filter treatment', () => {
        const { container, root } = renderDialog(['c', 'a'])

        try {
            expect(document.body.textContent).toContain(
                'Configure table columns'
            )
            expect(document.body.textContent).toContain('Available columns')
            expect(document.body.textContent).toContain('Selected columns')
            expect(
                document.querySelector(
                    '[data-test="column-settings-transfer-leftheader"] h4'
                )?.textContent
            ).toBe('Available columns')
            expect(
                document.querySelector(
                    '[data-test="column-settings-transfer-rightheader"] h4'
                )?.textContent
            ).toBe('Selected columns')
            expect(document.body.textContent).not.toContain(
                'Choose visible columns'
            )
            const filterInput = document.querySelector<HTMLInputElement>(
                '[data-test="column-settings-transfer-filter-input"] input'
            )
            expect(filterInput).not.toBeNull()
            expect(filterInput?.placeholder).toBe('Filter')

            const source = document.querySelector(
                '[data-test="column-settings-transfer-sourceoptions"]'
            )
            const picked = document.querySelector(
                '[data-test="column-settings-transfer-pickedoptions"]'
            )
            expect(source?.textContent).toContain('Column B')
            expect(source?.textContent).toContain('Column D')
            expect(source?.textContent).not.toContain('Column C')

            const setInputValue = Object.getOwnPropertyDescriptor(
                HTMLInputElement.prototype,
                'value'
            )?.set
            act(() => {
                setInputValue?.call(filterInput, 'Column D')
                filterInput?.dispatchEvent(
                    new Event('input', { bubbles: true })
                )
            })
            expect(source?.textContent).not.toContain('Column B')
            expect(source?.textContent).toContain('Column D')

            expect(
                [...(picked?.querySelectorAll('[data-value]') ?? [])].map(
                    (option) => option.getAttribute('data-value')
                )
            ).toEqual(['c', 'a'])
            expect(
                document.querySelector(
                    '[data-test="column-settings-transfer-reorderingactions"]'
                )
            ).not.toBeNull()

            const actionButtons = [
                'addall',
                'addindividual',
                'removeall',
                'removeindividual',
            ].map((action) =>
                document.querySelector<HTMLButtonElement>(
                    `[data-test="column-settings-transfer-actions-${action}"]`
                )
            )
            expect(actionButtons.every(Boolean)).toBe(true)
            for (const button of actionButtons) {
                expect(button?.textContent).toBe('')
                expect(button?.className).toContain('icon-only')
            }
        } finally {
            cleanUp(root, container)
        }
    })

    it('discards on Cancel and commits only from the primary save action', () => {
        const { container, onChange, onClose, root } = renderDialog(['c', 'a'])

        try {
            const cancel = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-cancel"]'
            )
            const save = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-done"]'
            )
            expect(cancel?.textContent).toBe('Cancel')
            expect(save?.textContent).toBe('Save column configuration')
            expect(save?.className).toContain('primary')

            act(() => cancel?.click())
            expect(onChange).not.toHaveBeenCalled()
            act(() => save?.click())
            expect(onChange).toHaveBeenCalledTimes(1)
            expect(onChange).toHaveBeenCalledWith(['c', 'a'])
            expect(onClose).toHaveBeenCalledTimes(2)
        } finally {
            cleanUp(root, container)
        }
    })

    it('uses the picked order when showing and reordering columns', () => {
        const { container, onChange, root } = renderDialog(['c', 'a'])

        try {
            const sourceB = document.querySelector<HTMLElement>(
                '[data-test="column-settings-transfer-sourceoptions"] [data-value="b"]'
            )
            const addSelected = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-transfer-actions-addindividual"]'
            )
            act(() => sourceB?.click())
            act(() => addSelected?.click())
            expect(onChange).not.toHaveBeenCalled()

            const pickedA = document.querySelector<HTMLElement>(
                '[data-test="column-settings-transfer-pickedoptions"] [data-value="a"]'
            )
            const moveUp = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-transfer-reorderingactions-buttonmoveup"]'
            )
            expect(moveUp?.getAttribute('aria-label')).toBe(
                'Move selected items up'
            )
            act(() => pickedA?.click())
            act(() => moveUp?.click())
            expect(onChange).not.toHaveBeenCalled()

            const save = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-done"]'
            )
            act(() => save?.click())
            expect(onChange).toHaveBeenCalledTimes(1)
            expect(onChange).toHaveBeenCalledWith(['a', 'c', 'b'])
        } finally {
            cleanUp(root, container)
        }
    })

    it('allows an empty draft and validates it only when saving', () => {
        const { container, onChange, onClose, root } = renderDialog(['c'])

        try {
            const onlyPickedOption = document.querySelector<HTMLElement>(
                '[data-test="column-settings-transfer-pickedoptions"] [data-value="c"]'
            )
            expect(onlyPickedOption?.className).not.toContain('disabled')

            const removeAll = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-transfer-actions-removeall"]'
            )
            act(() => removeAll?.click())
            expect(onChange).not.toHaveBeenCalled()
            expect(
                document.querySelectorAll(
                    '[data-test="column-settings-transfer-pickedoptions"] [data-value]'
                )
            ).toHaveLength(0)
            expect(document.querySelector('[role="alert"]')).toBeNull()

            const save = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-done"]'
            )
            act(() => save?.click())
            expect(onChange).not.toHaveBeenCalled()
            expect(onClose).not.toHaveBeenCalled()
            expect(document.querySelector('[role="alert"]')?.textContent).toBe(
                'Select at least one visible column'
            )

            const sourceA = document.querySelector<HTMLElement>(
                '[data-test="column-settings-transfer-sourceoptions"] [data-value="a"]'
            )
            const addSelected = document.querySelector<HTMLButtonElement>(
                '[data-test="column-settings-transfer-actions-addindividual"]'
            )
            act(() => sourceA?.click())
            act(() => addSelected?.click())
            expect(document.querySelector('[role="alert"]')).toBeNull()

            act(() => save?.click())
            expect(onChange).toHaveBeenCalledWith(['a'])
            expect(onClose).toHaveBeenCalledTimes(1)
        } finally {
            cleanUp(root, container)
        }
    })
})
