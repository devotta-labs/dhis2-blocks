import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { WorkingListField } from '../domain/model'
import {
    ColumnSettingsDialog,
    getInitialColumnDialogOrder,
    getVisibleColumnIdsInOrder,
} from './ColumnSettingsDialog'
import { WorkingListTextProvider } from './text'

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

describe('column settings dialog', () => {
    it('interleaves hidden columns while retaining saved visible order', () => {
        const ordered = getInitialColumnDialogOrder(fields, ['c', 'a'])
        expect(ordered.map((field) => field.id)).toEqual(['c', 'b', 'a', 'd'])
        expect(getVisibleColumnIdsInOrder(ordered, ['c', 'a'])).toEqual([
            'c',
            'a',
        ])

        expect(
            getVisibleColumnIdsInOrder(
                [ordered[2], ordered[1], ordered[0], ordered[3]],
                ['c', 'a']
            )
        ).toEqual(['a', 'c'])
    })

    it('renders drag handles, column names, and visibility controls as three columns', () => {
        const actEnvironment = globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT?: boolean
        }
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onChange = jest.fn()

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={translate}>
                        <ColumnSettingsDialog
                            fields={fields}
                            visibleColumnIds={['c', 'a']}
                            onChange={onChange}
                            onClose={jest.fn()}
                        />
                    </WorkingListTextProvider>
                )
            })

            const header = document.querySelector('.column-settings-header')
            expect(header?.textContent).toContain('Column')
            expect(header?.textContent).toContain('Visible')

            const rows = [
                ...document.querySelectorAll<HTMLElement>(
                    '[data-testid^="column-settings-row-"]'
                ),
            ]
            expect(rows.map((row) => row.dataset.testid)).toEqual([
                'column-settings-row-c',
                'column-settings-row-b',
                'column-settings-row-a',
                'column-settings-row-d',
            ])
            expect(
                rows[0]
                    ?.querySelector<HTMLButtonElement>(
                        '.column-settings-drag-handle'
                    )
                    ?.getAttribute('aria-label')
            ).toBe('Reorder Column C')

            const hiddenCheckbox = document.querySelector<HTMLInputElement>(
                '[data-test="column-b"] input'
            )
            expect(hiddenCheckbox?.checked).toBe(false)
            act(() => hiddenCheckbox?.click())
            expect(onChange).toHaveBeenLastCalledWith(['c', 'b', 'a'])

            expect(document.body.textContent).toContain(
                'To reorder a column, press Space to pick it up, use the arrow keys to move it, and press Space again to drop it.'
            )
        } finally {
            act(() => root.unmount())
            container.remove()
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })

    it('reorders visible columns with the keyboard drag sensor', async () => {
        const actEnvironment = globalThis as typeof globalThis & {
            IS_REACT_ACT_ENVIRONMENT?: boolean
        }
        const originalActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT
        const originalGetBoundingClientRect =
            HTMLElement.prototype.getBoundingClientRect
        actEnvironment.IS_REACT_ACT_ENVIRONMENT = true
        HTMLElement.prototype.getBoundingClientRect = function () {
            const row = this.closest<HTMLElement>(
                '[data-testid^="column-settings-row-"]'
            )
            const id = row?.dataset.testid?.replace('column-settings-row-', '')
            const index = ['c', 'b', 'a', 'd'].indexOf(id ?? '')
            const top = Math.max(index, 0) * 48
            return {
                x: 0,
                y: top,
                top,
                left: 0,
                right: 320,
                bottom: top + 48,
                width: 320,
                height: 48,
                toJSON: () => undefined,
            }
        }

        const container = document.createElement('div')
        document.body.appendChild(container)
        const root = createRoot(container)
        const onChange = jest.fn()

        try {
            act(() => {
                root.render(
                    <WorkingListTextProvider translate={translate}>
                        <ColumnSettingsDialog
                            fields={fields}
                            visibleColumnIds={['c', 'a']}
                            onChange={onChange}
                            onClose={jest.fn()}
                        />
                    </WorkingListTextProvider>
                )
            })

            const handle = document.querySelector<HTMLButtonElement>(
                '[data-testid="column-settings-row-c"] .column-settings-drag-handle'
            )
            expect(handle).not.toBeNull()
            act(() => {
                handle?.focus()
                handle?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        bubbles: true,
                        code: 'Space',
                        key: ' ',
                    })
                )
            })
            await act(async () => {
                await new Promise((resolve) => setTimeout(resolve, 0))
            })
            act(() => {
                handle?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        bubbles: true,
                        code: 'ArrowDown',
                        key: 'ArrowDown',
                    })
                )
            })
            act(() => {
                handle?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        bubbles: true,
                        code: 'ArrowDown',
                        key: 'ArrowDown',
                    })
                )
            })
            act(() => {
                handle?.dispatchEvent(
                    new KeyboardEvent('keydown', {
                        bubbles: true,
                        code: 'Space',
                        key: ' ',
                    })
                )
            })

            expect(onChange).toHaveBeenLastCalledWith(['a', 'c'])
        } finally {
            act(() => root.unmount())
            container.remove()
            HTMLElement.prototype.getBoundingClientRect =
                originalGetBoundingClientRect
            actEnvironment.IS_REACT_ACT_ENVIRONMENT = originalActEnvironment
        }
    })
})
