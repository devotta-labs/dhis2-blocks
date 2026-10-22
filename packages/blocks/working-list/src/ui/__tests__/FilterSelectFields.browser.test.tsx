import React, { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { resolveWorkingListCapabilities } from '../../api/capabilities'
import type { WorkingListClient } from '../../api/client'
import type { AppliedFilter, WorkingListField } from '../../domain/model'
import { FilterButton } from '../FilterControls'
import { ComboboxField } from '../FilterControls/FilterSelectFields'
import { WorkingListTextProvider } from '../WorkingListText'

const unusedClient: WorkingListClient = {
    query: () => Promise.reject(new Error('Unexpected query')),
    mutate: () => Promise.reject(new Error('Unexpected mutation')),
}

const resultField: WorkingListField = {
    id: 'result',
    displayName: 'Result',
    source: 'trackedEntityAttribute',
    scope: 'trackedEntity',
    valueType: 'TEXT',
    filterable: true,
    options: [
        { code: 'POS', displayName: 'Positive' },
        { code: 'NEG', displayName: 'Negative' },
        { code: 'INC', displayName: 'Inconclusive' },
    ],
}

const options = [
    { value: 'POS', label: 'Positive' },
    { value: 'NEG', label: 'Negative' },
    { value: 'INC', label: 'Inconclusive' },
]

const ControlledCombobox = ({
    multiple,
    initialValues = [],
    loading,
    onSearchChange,
}: {
    multiple?: boolean
    initialValues?: string[]
    loading?: boolean
    onSearchChange?: (search: string) => void
}) => {
    const [values, setValues] = useState<string[]>(initialValues)
    return (
        <WorkingListTextProvider translate={(message) => message}>
            <ComboboxField
                multiple={multiple}
                label="Values"
                values={values}
                options={options}
                filterPlaceholder="Search values"
                noMatchText="No values match"
                loading={loading}
                onSearchChange={onSearchChange}
                onChange={setValues}
            />
            <output data-testid="values">{values.join(',')}</output>
        </WorkingListTextProvider>
    )
}

describe('filter select fields', () => {
    it('picks and removes option values inside a filter editor without closing it', async () => {
        const onApply = vi.fn<(filter: AppliedFilter) => void>()
        await render(
            <WorkingListTextProvider translate={(message) => message}>
                <FilterButton
                    client={unusedClient}
                    field={resultField}
                    capabilities={resolveWorkingListCapabilities({
                        apiVersion: 43,
                    })}
                    calendarContext={{
                        calendar: 'gregorian',
                        dateFormat: 'YYYY-MM-DD',
                        locale: 'en',
                        timeZone: 'Etc/UTC',
                    }}
                    onApply={onApply}
                    onReset={() => undefined}
                />
            </WorkingListTextProvider>
        )
        await page.getByTestId('filter-result').getByRole('combobox').click()
        const editor = page.getByTestId('filter-editor-result')
        await expect.element(editor).toBeVisible()

        await editor.getByRole('combobox', { name: 'Values' }).click()
        await page.getByRole('option', { name: 'Positive' }).click()
        await page.getByRole('option', { name: 'Negative' }).click()
        await expect
            .element(page.getByRole('option', { name: 'Negative' }))
            .toHaveAttribute('aria-selected', 'true')

        await userEvent.keyboard('{Escape}')
        await expect.element(editor).toBeVisible()
        await expect.element(editor).toHaveTextContent(/Positive.*Negative/)

        await editor
            .getByRole('button', { name: 'Remove {{label}}' })
            .first()
            .click()
        await expect.element(editor).not.toHaveTextContent('Positive')

        await editor.getByRole('button', { name: 'Update' }).click()
        expect(onApply).toHaveBeenCalledWith(
            expect.objectContaining({
                value: { kind: 'options', values: ['NEG'] },
            })
        )
    })

    it('filters a single-value combobox by label', async () => {
        const screen = await render(<ControlledCombobox />)

        await screen.getByRole('combobox', { name: 'Values' }).click()
        await page.getByRole('combobox', { name: 'Search values' }).fill('inc')
        await expect
            .element(page.getByRole('option', { name: 'Positive' }))
            .not.toBeInTheDocument()
        await page.getByRole('option', { name: 'Inconclusive' }).click()

        await expect
            .element(screen.getByTestId('values'))
            .toHaveTextContent('INC')
        await expect
            .element(screen.getByRole('combobox', { name: 'Values' }))
            .toHaveTextContent('Inconclusive')
    })

    it('lists every option when a single-value combobox reopens with a value', async () => {
        const screen = await render(
            <ControlledCombobox initialValues={['INC']} />
        )

        await screen.getByRole('combobox', { name: 'Values' }).click()
        for (const name of ['Positive', 'Negative', 'Inconclusive']) {
            await expect
                .element(page.getByRole('option', { name }))
                .toBeVisible()
        }
    })

    it('shows loading above results that are still listed', async () => {
        const screen = await render(
            <ControlledCombobox multiple loading onSearchChange={vi.fn()} />
        )

        await screen.getByRole('combobox', { name: 'Values' }).click()
        await expect
            .element(page.getByRole('option', { name: 'Positive' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('status', { name: 'Loading' }))
            .toBeVisible()
    })

    it('hands the search to the caller when it filters remotely', async () => {
        const onSearchChange = vi.fn()
        const screen = await render(
            <ControlledCombobox multiple onSearchChange={onSearchChange} />
        )

        await screen.getByRole('combobox', { name: 'Values' }).click()
        await page.getByRole('combobox', { name: 'Search values' }).fill('xyz')

        expect(onSearchChange).toHaveBeenLastCalledWith(
            'xyz',
            expect.anything()
        )
        // Remote filtering leaves the caller's options untouched.
        await expect
            .element(page.getByRole('option', { name: 'Positive' }))
            .toBeVisible()
    })
})
