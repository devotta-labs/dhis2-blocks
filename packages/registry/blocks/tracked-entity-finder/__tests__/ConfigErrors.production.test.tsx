import React, { useState } from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderField } from '../hooks'
import { describeProblem } from '../rules/describeProblem'
import { buildProgramModel } from '../rules/programModel'
import { hivProgram } from './fixtures/program'
import { renderInFinder } from './finderTestSupport'

// Runs in the `browser-production` project, built with
// `process.env.NODE_ENV` set to "production" as an app's production build is.

const model = buildProgramModel(hivProgram)
const notSearchable = describeProblem(model, {
    kind: 'not-searchable',
    attribute: 'legacyId',
})
const cannotSearch = describeProblem(model, { kind: 'form-cannot-search' })

/** Sets a value for a field without rendering an input, as a custom part could. */
const LegacyIdSetter = () => {
    const { setValue } = useFinderField('legacyId')
    return (
        <button
            type="button"
            onClick={() => setValue({ kind: 'text', text: 'L-1' })}
        >
            Set legacy ID
        </button>
    )
}

describe('config errors in production', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows the short message and logs in production', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderInFinder(
            <FinderForm>
                <FinderField attribute="legacyId" />
                <LegacyIdSetter />
                <FinderField attribute="firstName" />
                <FinderField attribute="dob" />
                <FinderSubmit />
            </FinderForm>
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent("This search isn't set up correctly")
        await expect
            .element(page.getByRole('alert'))
            .not.toHaveTextContent('legacyId')

        await page.getByRole('button', { name: 'Set legacy ID' }).click()
        await userEvent.fill(page.getByLabelText('First name'), 'Joe')
        await userEvent.fill(page.getByLabelText('Date of birth'), '2001-02-03')
        await userEvent.tab()
        await page.getByRole('button', { name: 'Search' }).click()

        await expect
            .element(page.getByTestId('submission'))
            .toHaveTextContent('firstName:like:Joe dob:eq:2001-02-03')
        await expect
            .element(page.getByTestId('submission'))
            .not.toHaveTextContent('legacyId')
        expect(
            error.mock.calls.filter(([message]) => message === notSearchable)
        ).toHaveLength(1)
    })

    it('reports a form that can never search, in production', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderInFinder(
            <FinderForm aria-label="Legacy">
                <FinderField attribute="legacyId" />
            </FinderForm>
        )

        await expect
            .element(
                page
                    .getByRole('form', { name: 'Legacy' })
                    .getByText("This search isn't set up correctly")
                    .first()
            )
            .toBeVisible()
        await expect
            .poll(() =>
                error.mock.calls.filter(([message]) => message === cannotSearch)
            )
            .toHaveLength(1)
    })

    it('reports a form that can never search when it mounts after loading', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        const Later = () => {
            const [shown, setShown] = useState(false)
            return (
                <>
                    <FinderForm aria-label="ID">
                        <FinderField attribute="artNumber" />
                    </FinderForm>
                    {shown ? (
                        <FinderForm aria-label="Legacy">
                            <FinderField attribute="legacyId" />
                        </FinderForm>
                    ) : (
                        <button type="button" onClick={() => setShown(true)}>
                            Show legacy form
                        </button>
                    )}
                </>
            )
        }
        await renderInFinder(<Later />)
        await expect
            .element(page.getByLabelText('ART number'))
            .not.toBeDisabled()

        await page.getByRole('button', { name: 'Show legacy form' }).click()

        await expect
            .element(
                page
                    .getByRole('form', { name: 'Legacy' })
                    .getByText("This search isn't set up correctly")
                    .first()
            )
            .toBeVisible()
        await expect
            .poll(() =>
                error.mock.calls.filter(([message]) => message === cannotSearch)
            )
            .toHaveLength(1)
    })
})
