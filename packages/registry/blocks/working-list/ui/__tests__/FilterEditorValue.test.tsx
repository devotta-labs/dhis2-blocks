import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { WorkingListField } from '../../domain/model'
import { FilterButton } from '../FilterControls'
import { WorkingListTextProvider } from '../WorkingListText'

const unusedClient: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query')),
    mutate: () => Promise.reject(new Error('Unexpected mutation')),
}

const field = (overrides: Partial<WorkingListField>): WorkingListField => ({
    id: 'firstName',
    displayName: 'First name',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
    ...overrides,
})

const openEditor = async (filterField: WorkingListField) => {
    await render(
        <WorkingListTextProvider translate={(message) => message}>
            <FilterButton
                client={unusedClient}
                field={filterField}
                capabilities={resolveWorkingListCapabilities({
                    apiVersion: 43,
                })}
                calendarContext={{
                    calendar: 'gregorian',
                    dateFormat: 'YYYY-MM-DD',
                    locale: 'en',
                    timeZone: 'Etc/UTC',
                }}
                onApply={() => undefined}
                onReset={() => undefined}
            />
        </WorkingListTextProvider>
    )
    await page
        .getByTestId(`filter-${filterField.id}`)
        .getByRole('combobox')
        .click()
    const editor = page.getByTestId(`filter-editor-${filterField.id}`)
    await expect.element(editor).toBeVisible()
    return editor
}

describe('filter editor value fields', () => {
    it('renders the text value as a dense Input', async () => {
        const editor = await openEditor(field({}))
        const input = editor.getByRole('textbox', { name: 'Value' }).element()
        expect(input.getAttribute('data-slot')).toBe('input')
        expect(getComputedStyle(input).height).toBe('32px')
    })

    it('describes the minimum search length on the input', async () => {
        const editor = await openEditor(field({ minCharactersToSearch: 3 }))
        await expect
            .element(editor.getByRole('textbox', { name: 'Value' }))
            .toHaveAccessibleDescription(/Enter at least/)
    })

    it('renders a number range as two labelled Inputs', async () => {
        const editor = await openEditor(
            field({ id: 'weight', displayName: 'Weight', valueType: 'NUMBER' })
        )
        for (const name of ['Minimum', 'Maximum']) {
            const input = editor.getByRole('spinbutton', { name }).element()
            expect(input.getAttribute('data-slot')).toBe('input')
        }
    })

    it('greys the label and the description as before', async () => {
        const editor = await openEditor(field({ minCharactersToSearch: 3 }))
        const label = editor.getByText('Value', { exact: true }).element()
        const hint = editor.getByText(/Enter at least/).element()
        expect(getComputedStyle(label).color).toBe('rgb(74, 87, 104)')
        expect(getComputedStyle(hint).color).toBe('rgb(108, 119, 135)')
    })
})
