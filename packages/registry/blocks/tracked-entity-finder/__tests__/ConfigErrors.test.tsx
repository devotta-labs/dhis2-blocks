import React, { useState, type ErrorInfo, type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderHint } from '../form/FinderHint'
import { FinderRangeField } from '../form/FinderRangeField'
import { FinderSubmit } from '../form/FinderSubmit'
import { FinderProvider } from '../provider/FinderProvider'
import { describeProblem } from '../rules/describeProblem'
import { buildProgramModel } from '../rules/programModel'
import { hivProgram } from './fixtures/program'
import {
    createFakeServer,
    renderInFinder,
    renderWithQueries,
} from './finderTestSupport'

const model = buildProgramModel(hivProgram)
const notSearchable = describeProblem(model, {
    kind: 'not-searchable',
    attribute: 'legacyId',
})
const conflict = describeProblem(model, {
    kind: 'shape-conflict',
    attribute: 'dob',
})

interface Caught {
    message?: string
}

class Catch extends React.Component<{ children: ReactNode }, Caught> {
    state: Caught = {}

    static getDerivedStateFromError(error: Error) {
        return { message: error.message }
    }

    componentDidCatch(_error: Error, _info: ErrorInfo) {}

    render() {
        return this.state.message === undefined ? (
            this.props.children
        ) : (
            <p data-testid="caught">{this.state.message}</p>
        )
    }
}

describe('config errors', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('shows the full message in development', async () => {
        await renderInFinder(
            <FinderForm>
                <FinderField attribute="legacyId" />
                <FinderField attribute="firstName" />
                <FinderField attribute="dob" />
            </FinderForm>
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent(notSearchable)
        await expect
            .element(page.getByRole('textbox', { name: 'Legacy ID' }))
            .not.toBeInTheDocument()
    })

    it('flags the same attribute as both exact and range', async () => {
        await renderInFinder(
            <>
                <FinderForm aria-label="Exact">
                    <FinderField attribute="dob" />
                </FinderForm>
                <FinderForm aria-label="Range">
                    <FinderRangeField attribute="dob" />
                </FinderForm>
            </>
        )

        await expect
            .element(
                page.getByRole('form', { name: 'Exact' }).getByText(conflict)
            )
            .toBeVisible()
        await expect
            .element(
                page.getByRole('form', { name: 'Range' }).getByText(conflict)
            )
            .toBeVisible()
    })

    it('recovers a form when the form composing the range unmounts', async () => {
        const Forms = () => {
            const [range, setRange] = useState(true)
            return (
                <>
                    <FinderForm aria-label="Details">
                        <FinderField attribute="firstName" />
                        <FinderField attribute="dob" />
                        <FinderSubmit />
                    </FinderForm>
                    {range && (
                        <FinderForm aria-label="Range">
                            <FinderRangeField attribute="dob" />
                        </FinderForm>
                    )}
                    <button type="button" onClick={() => setRange(false)}>
                        Hide range
                    </button>
                </>
            )
        }
        await renderInFinder(<Forms />)
        const details = page.getByRole('form', { name: 'Details' })

        await expect.element(details.getByText(conflict)).toBeVisible()
        await expect
            .element(
                page.getByRole('form', { name: 'Range' }).getByText(conflict)
            )
            .toBeVisible()
        await userEvent.fill(details.getByLabelText('First name'), 'Joe')
        await expect
            .element(details.getByRole('button', { name: 'Search' }))
            .toBeDisabled()

        await page.getByRole('button', { name: 'Hide range' }).click()
        await expect
            .element(details.getByText(conflict))
            .not.toBeInTheDocument()
        await userEvent.fill(
            details.getByLabelText('Date of birth'),
            '2001-02-03'
        )
        await userEvent.tab()
        await expect
            .element(details.getByRole('button', { name: 'Search' }))
            .toBeEnabled()
        await details.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(page.getByTestId('submission'))
            .toHaveTextContent('firstName:like:Joe dob:eq:2001-02-03')
    })

    it('throws when a field is outside a form or a part is outside the provider', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {})
        const server = createFakeServer()
        await renderWithQueries(
            <>
                <Catch>
                    <FinderProvider
                        program="hivProgram"
                        client={server.client}
                        onSelect={vi.fn()}
                    >
                        <FinderField attribute="firstName" />
                    </FinderProvider>
                </Catch>
                <Catch>
                    <FinderProvider
                        program="hivProgram"
                        client={server.client}
                        onSelect={vi.fn()}
                    >
                        <FinderHint />
                    </FinderProvider>
                </Catch>
                <Catch>
                    <FinderProvider
                        program="hivProgram"
                        client={server.client}
                        onSelect={vi.fn()}
                    >
                        <FinderSubmit />
                    </FinderProvider>
                </Catch>
                <Catch>
                    <FinderForm />
                </Catch>
            </>
        )

        const caught = page.getByTestId('caught')
        const outsideForm =
            'FinderField, FinderRangeField, FinderHint, FinderSubmit, useFinderField, useFinderRangeField and useFinderSearch must be rendered inside FinderForm'
        for (const index of [0, 1, 2]) {
            await expect
                .element(caught.nth(index))
                .toHaveTextContent(outsideForm)
        }
        await expect
            .element(caught.nth(3))
            .toHaveTextContent(
                'Finder parts and hooks must be rendered inside FinderProvider'
            )
    })
})
