import React, { type ErrorInfo, type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderHint } from '../form/FinderHint'
import { FinderRangeField } from '../form/FinderRangeField'
import { FinderSubmit } from '../form/FinderSubmit'
import { FinderProvider } from '../provider/FinderProvider'
import { describeMetadataError } from '../rules/describeMetadataError'
import { buildProgramModel } from '../rules/programModel'
import { hivProgram } from './fixtures/program'
import {
    createFakeServer,
    renderInFinder,
    renderWithQueries,
} from './finderTestSupport'

// The fake server is DHIS2 2.43, which searches MULTI_TEXT.
const model = buildProgramModel(hivProgram, { multiTextSearch: true })
const notSearchable = describeMetadataError(model, {
    kind: 'not-searchable',
    attribute: 'legacyId',
})
const conflict = describeMetadataError(model, {
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

describe('metadata errors', () => {
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

    it('flags the same attribute as both exact and range in one form', async () => {
        await renderInFinder(
            <FinderForm aria-label="Both">
                <FinderField attribute="firstName" />
                <FinderField attribute="weight" />
                <FinderField attribute="dob" />
                <FinderRangeField attribute="dob" />
                <FinderSubmit />
            </FinderForm>
        )
        const form = page.getByRole('form', { name: 'Both' })

        await expect.element(form.getByText(conflict).first()).toBeVisible()
        await userEvent.fill(form.getByLabelText('First name'), 'Joe')
        await userEvent.fill(form.getByLabelText('Weight'), '60')
        await form.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(page.getByTestId('submission'))
            .toHaveTextContent('firstName:like:Joe weight:eq:60')
        await expect
            .element(page.getByTestId('submission'))
            .not.toHaveTextContent('dob')
    })

    it('lets separate forms use one attribute both ways', async () => {
        await renderInFinder(
            <>
                <FinderForm aria-label="Exact">
                    <FinderField attribute="firstName" />
                    <FinderField attribute="dob" />
                    <FinderSubmit />
                </FinderForm>
                <FinderForm aria-label="Range">
                    <FinderField attribute="firstName" />
                    <FinderRangeField attribute="dob" />
                </FinderForm>
            </>
        )
        const exact = page.getByRole('form', { name: 'Exact' })

        await expect.element(page.getByText(conflict)).not.toBeInTheDocument()
        await userEvent.fill(exact.getByLabelText('First name'), 'Joe')
        await userEvent.fill(
            exact.getByLabelText('Date of birth'),
            '2001-02-03'
        )
        await userEvent.tab()
        await exact.getByRole('button', { name: 'Search' }).click()
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
