import React from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderField, useFinderForm } from '../hooks'
import { renderInFinder } from './finderTestSupport'

const submission = () => page.getByTestId('submission')

describe('FinderForm validation', () => {
    it('shows every issue and searches nothing when a search is tried', async () => {
        await renderInFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="weight" />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await userEvent.fill(page.getByLabelText('Weight'), '7.5')
        // Search stays clickable, so it can say what is wrong.
        const search = page.getByRole('button', { name: 'Search' })
        await expect.element(search).toBeEnabled()
        await search.click()

        await expect
            .element(page.getByText('Enter a whole number'))
            .toBeVisible()
        await expect.element(submission()).toHaveTextContent('none')
    })

    it('runs a custom field through the TanStack form and its Zod schema', async () => {
        const CustomWeight = () => {
            const { field, error } = useFinderField('weight')
            const value = field.state.value
            return (
                <label>
                    Custom weight
                    <input
                        value={value?.kind === 'number' ? value.value : ''}
                        onChange={(event) =>
                            field.handleChange({
                                kind: 'number',
                                value: event.target.value,
                            })
                        }
                        onBlur={field.handleBlur}
                    />
                    <output data-testid="errors">
                        {field.state.meta.errors.join(',')}
                    </output>
                    <output data-testid="error">{error}</output>
                </label>
            )
        }
        const Values = () => {
            const form = useFinderForm()
            return (
                <form.Subscribe selector={(state) => state.values}>
                    {(values) => (
                        <output data-testid="values">
                            {JSON.stringify(values)}
                        </output>
                    )}
                </form.Subscribe>
            )
        }
        await renderInFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <CustomWeight />
                <Values />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('Custom weight'), '7.5')
        // TanStack has the error at once; `error` waits for the field to be left.
        await expect
            .element(page.getByTestId('errors'))
            .toHaveTextContent('Enter a whole number')
        await expect.element(page.getByTestId('error')).toHaveTextContent('')
        await userEvent.tab()
        await expect
            .element(page.getByTestId('error'))
            .toHaveTextContent('Enter a whole number')
        await expect
            .element(page.getByTestId('values'))
            .toHaveTextContent('{"weight":{"kind":"number","value":"7.5"}}')

        await userEvent.fill(page.getByLabelText('Custom weight'), '72')
        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await expect.element(page.getByTestId('errors')).toHaveTextContent('')
        await expect.element(page.getByTestId('error')).toHaveTextContent('')
        await page.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(submission())
            .toHaveTextContent(/firstName:like:Jo\s+weight:eq:72/)
    })
})
