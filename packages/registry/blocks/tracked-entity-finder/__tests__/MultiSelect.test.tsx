import React, { type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { FinderProvider } from '../provider/FinderProvider'
import {
    createFakeServer,
    renderWithQueries,
    SubmissionProbe,
} from './finderTestSupport'

const renderFinder = (children: ReactNode, version?: string) => {
    const server = createFakeServer({ version })
    return renderWithQueries(
        <FinderProvider program="hivProgram" onSelect={vi.fn()}>
            {children}
            <SubmissionProbe />
        </FinderProvider>,
        server
    )
}

const submission = () => page.getByTestId('submission')

describe('multi-select fields', () => {
    it('searches for people who have every option picked in a multi-select', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="allergies" />
                <FinderSubmit />
            </FinderForm>
        )
        const allergies = page.getByRole('combobox', { name: 'Allergies' })

        await expect.element(allergies).toBeVisible()
        await allergies.click()
        await page.getByRole('option', { name: 'Sulfa drugs' }).click()
        await page.getByRole('option', { name: 'Penicillin' }).click()
        await userEvent.keyboard('{Escape}')
        await expect
            .element(page.getByRole('button', { name: 'Remove Penicillin' }))
            .toBeVisible()
        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await page.getByRole('button', { name: 'Search' }).click()

        await expect
            .element(submission())
            .toHaveTextContent('firstName:like:Jo allergies:eq:PEN:eq:SULFA')

        await page.getByRole('button', { name: 'Remove Sulfa drugs' }).click()
        await page.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(submission())
            .toHaveTextContent('firstName:like:Jo allergies:eq:PEN')
    })

    it('reports a multi-select as unsearchable before DHIS2 2.43', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="dob" />
                <FinderField attribute="allergies" />
            </FinderForm>,
            '2.42.4'
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('searches only from version 2.43')
        await expect
            .element(page.getByRole('combobox', { name: 'Allergies' }))
            .not.toBeInTheDocument()
    })
})
