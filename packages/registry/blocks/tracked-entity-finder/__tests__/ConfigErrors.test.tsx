import React, { useState, type ErrorInfo, type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderRangeField } from '../form/FinderRangeField'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderField } from '../hooks'
import { FinderProvider } from '../provider/FinderProvider'
import { describeProblem } from '../rules/describeProblem'
import { buildProgramModel } from '../rules/programModel'
import { hivProgram } from './fixtures/program'
import {
    createFakeServer,
    renderWithQueries,
    SubmissionProbe,
} from './finderTestSupport'

const model = buildProgramModel(hivProgram)
const notSearchable = describeProblem(model, {
    kind: 'not-searchable',
    attribute: 'legacyId',
})
const cannotSearch = describeProblem(model, { kind: 'form-cannot-search' })
const conflict = describeProblem(model, {
    kind: 'shape-conflict',
    attribute: 'dob',
})

const renderFinder = (children: ReactNode) => {
    const server = createFakeServer()
    return renderWithQueries(
        <FinderProvider
            program="hivProgram"
            client={server.client}
            onSelect={vi.fn()}
        >
            {children}
            <SubmissionProbe />
        </FinderProvider>
    )
}

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
        vi.unstubAllEnvs()
        vi.restoreAllMocks()
    })

    it('shows the full message in development', async () => {
        await renderFinder(
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

    it('shows the short message and logs in production', async () => {
        vi.stubEnv('NODE_ENV', 'production')
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderFinder(
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
        vi.stubEnv('NODE_ENV', 'production')
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderFinder(
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
        vi.stubEnv('NODE_ENV', 'production')
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
        await renderFinder(<Later />)
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

    it('flags the same attribute as both exact and range', async () => {
        await renderFinder(
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
        await renderFinder(<Forms />)
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
                    <FinderForm />
                </Catch>
            </>
        )

        const caught = page.getByTestId('caught')
        await expect
            .element(caught.nth(0))
            .toHaveTextContent(
                'FinderField and field hooks must be rendered inside FinderForm'
            )
        await expect
            .element(caught.nth(1))
            .toHaveTextContent(
                'Finder parts and hooks must be rendered inside FinderProvider'
            )
    })
})
