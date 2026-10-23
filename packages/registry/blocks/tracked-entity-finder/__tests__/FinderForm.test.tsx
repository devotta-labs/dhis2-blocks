import React, {
    useContext,
    useState,
    type FormEvent,
    type ReactNode,
} from 'react'
import { page, userEvent } from 'vitest/browser'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderHint } from '../form/FinderHint'
import { FinderRangeField } from '../form/FinderRangeField'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderField, useFinderRangeField } from '../hooks'
import { FinderContext } from '../provider/context'
import { FinderProvider } from '../provider/FinderProvider'
import {
    createFakeServer,
    renderWithQueries,
    SubmissionProbe,
} from './finderTestSupport'

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

/** Test-only: the attributes every form has registered, in order. */
const FieldsProbe = () => {
    const context = useContext(FinderContext)
    return (
        <output data-testid="fields">
            {context?.state.fields.map(({ attribute }) => attribute).join(',')}
        </output>
    )
}

const submission = () => page.getByTestId('submission')

const typeDate = async (label: string, text: string) => {
    await userEvent.fill(page.getByLabelText(label), text)
    // CalendarInput reports a typed date when the input loses focus.
    await userEvent.tab()
}

describe('FinderForm', () => {
    it('renders one input per composed field with metadata labels', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="sex" />
                <FinderField attribute="dob" />
                <FinderField attribute="weight" />
            </FinderForm>
        )

        await expect
            .element(page.getByRole('textbox', { name: 'First name' }))
            .toBeEnabled()
        await expect
            .element(page.getByRole('combobox', { name: 'Sex' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('textbox', { name: 'Date of birth' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('textbox', { name: 'Weight' }))
            .toBeVisible()

        await page.getByRole('combobox', { name: 'Sex' }).click()
        await expect
            .element(page.getByRole('option', { name: 'Female' }))
            .toBeVisible()
    })

    it('renders From and To for a range field', async () => {
        await renderFinder(
            <FinderForm>
                <FinderRangeField attribute="dob" />
                <FinderRangeField attribute="weight" />
            </FinderForm>
        )

        const dob = page.getByRole('group', { name: 'Date of birth' })
        const weight = page.getByRole('group', { name: 'Weight' })
        await expect.element(dob.getByLabelText('From')).toBeVisible()
        await expect.element(dob.getByLabelText('To')).toBeVisible()
        await expect.element(weight.getByLabelText('From')).toBeVisible()
        await expect.element(weight.getByLabelText('To')).toBeVisible()

        await userEvent.fill(weight.getByLabelText('From'), '80')
        await userEvent.fill(weight.getByLabelText('To'), '60')
        await expect
            .element(weight.getByText('From must not be after To'))
            .toBeVisible()
        await expect
            .element(weight.getByLabelText('To'))
            .toHaveAttribute('aria-invalid', 'true')
    })

    it('keeps Search disabled until the form can search, with a hint', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="dob" />
                <FinderHint data-testid="hint" />
                <FinderSubmit />
            </FinderForm>
        )
        const search = page.getByRole('button', { name: 'Search' })

        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await expect.element(search).toBeDisabled()
        await expect
            .element(page.getByText('Add 1 more detail to search'))
            .toBeVisible()

        await typeDate('Date of birth', '2001-02-03')
        await expect.element(search).toBeEnabled()
        await expect.element(page.getByTestId('hint')).not.toBeInTheDocument()
    })

    it('shows a field issue inline and marks the input invalid', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="firstName" />
                <FinderField attribute="weight" />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('Weight'), '7.5')
        await expect
            .element(page.getByText('Enter a whole number'))
            .toBeVisible()
        await expect
            .element(page.getByLabelText('Weight'))
            .toHaveAttribute('aria-invalid', 'true')
    })

    it('searches by an ID alone and says so', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="artNumber" />
                <FinderField attribute="firstName" />
                <FinderField attribute="dob" />
                <FinderHint />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await expect
            .element(page.getByText('Searching by ART number only'))
            .toBeVisible()

        await page.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(submission())
            .toHaveTextContent(/^artNumber:eq:ART-1$/)
    })

    it('keeps two forms apart under one provider', async () => {
        await renderFinder(
            <>
                <FinderForm aria-label="ID">
                    <FinderField attribute="artNumber" />
                    <FinderSubmit />
                </FinderForm>
                <FinderForm aria-label="Details">
                    <FinderField attribute="firstName" />
                    <FinderField attribute="dob" />
                    <FinderSubmit />
                </FinderForm>
            </>
        )
        const details = page.getByRole('form', { name: 'Details' })

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await userEvent.fill(page.getByLabelText('First name'), 'Joe')
        await typeDate('Date of birth', '2001-02-03')
        await details.getByRole('button', { name: 'Search' }).click()

        await expect
            .element(submission())
            .toHaveTextContent('firstName:like:Joe dob:eq:2001-02-03')
        await expect.element(submission()).not.toHaveTextContent('artNumber')
    })

    it("drops a form's fields when it unmounts", async () => {
        const NoIdSwap = () => {
            const [noId, setNoId] = useState(false)
            return noId ? (
                <FinderForm aria-label="Details">
                    <FinderField attribute="firstName" />
                    <FinderField attribute="dob" />
                    <FinderHint />
                    <FinderSubmit />
                </FinderForm>
            ) : (
                <>
                    <FinderForm aria-label="ID">
                        <FinderField attribute="artNumber" />
                        <FinderSubmit />
                    </FinderForm>
                    <button type="button" onClick={() => setNoId(true)}>
                        No ID?
                    </button>
                </>
            )
        }
        await renderFinder(
            <>
                <NoIdSwap />
                <FieldsProbe />
            </>
        )

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await page.getByRole('button', { name: 'Search' }).click()
        await expect
            .element(submission())
            .toHaveTextContent('artNumber:eq:ART-1')

        await page.getByRole('button', { name: 'No ID?' }).click()
        await expect
            .element(page.getByTestId('fields'))
            .toHaveTextContent(/^firstName,dob$/)
        // The last search stays until the next Search.
        await expect
            .element(submission())
            .toHaveTextContent('artNumber:eq:ART-1')

        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await expect
            .element(page.getByText('Add 1 more detail to search'))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeDisabled()
    })

    it('submits on Enter', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="dob" />
                <FinderField attribute="firstName" />
                <FinderSubmit />
            </FinderForm>
        )

        await typeDate('Date of birth', '2001-02-03')
        await userEvent.fill(page.getByLabelText('First name'), 'Joe')
        await userEvent.keyboard('{Enter}')

        await expect
            .element(submission())
            .toHaveTextContent('dob:eq:2001-02-03 firstName:like:Joe')
    })

    it('passes className and native props through', async () => {
        const onSubmit = vi.fn()
        await renderFinder(
            <FinderForm
                aria-label="Find"
                className="find-form"
                data-testid="find-form"
                onSubmit={onSubmit}
            >
                <FinderField attribute="artNumber" />
                <FinderSubmit className="find-submit" data-testid="find">
                    Find person
                </FinderSubmit>
            </FinderForm>
        )

        const form = page.getByRole('form', { name: 'Find' })
        await expect.element(form).toHaveClass('find-form')
        await expect.element(form).toHaveAttribute('data-testid', 'find-form')
        const submit = page.getByRole('button', { name: 'Find person' })
        await expect.element(submit).toHaveClass('find-submit')
        await expect.element(submit).toHaveAttribute('data-testid', 'find')

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await submit.click()
        expect(onSubmit).toHaveBeenCalledTimes(1)
        await expect
            .element(submission())
            .toHaveTextContent('artNumber:eq:ART-1')
    })

    it('disables fields with a spinner while metadata loads', async () => {
        const server = createFakeServer({ programPending: true })
        await renderWithQueries(
            <FinderProvider
                program="hivProgram"
                client={server.client}
                onSelect={vi.fn()}
            >
                <FinderForm>
                    <FinderField attribute="firstName" label="First name" />
                    <FinderSubmit />
                </FinderForm>
            </FinderProvider>
        )

        await expect.element(page.getByRole('status')).toBeVisible()
        await expect.element(page.getByLabelText('First name')).toBeDisabled()
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeDisabled()
    })

    it('keeps fields disabled with their labels while system info loads', async () => {
        const server = createFakeServer({ systemInfoPending: true })
        await renderWithQueries(
            <FinderProvider
                program="hivProgram"
                client={server.client}
                onSelect={vi.fn()}
            >
                <FinderForm>
                    <FinderField attribute="firstName" />
                    <FinderField attribute="dob" />
                    <FinderSubmit />
                </FinderForm>
            </FinderProvider>
        )

        await expect.element(page.getByRole('status')).toBeVisible()
        await expect.element(page.getByLabelText('First name')).toBeDisabled()
        await expect
            .element(page.getByLabelText('Date of birth'))
            .toBeDisabled()
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeDisabled()
    })

    it('shows an error and keeps fields disabled when system info fails', async () => {
        const server = createFakeServer({ systemInfoFails: true })
        await renderWithQueries(
            <FinderProvider
                program="hivProgram"
                client={server.client}
                onSelect={vi.fn()}
            >
                <FinderForm>
                    <FinderField attribute="firstName" />
                    <FinderField attribute="dob" />
                    <FinderSubmit />
                </FinderForm>
            </FinderProvider>
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent("The search couldn't be loaded")
        await expect.element(page.getByLabelText('First name')).toBeDisabled()
        await expect
            .element(page.getByLabelText('Date of birth'))
            .toBeDisabled()
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeDisabled()
    })

    it('shows an error in the form when metadata fails', async () => {
        const server = createFakeServer({ programFails: true })
        await renderWithQueries(
            <FinderProvider
                program="hivProgram"
                client={server.client}
                onSelect={vi.fn()}
            >
                <FinderForm>
                    <FinderField attribute="firstName" />
                </FinderForm>
            </FinderProvider>
        )

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent("The search couldn't be loaded")
    })

    it('skips the search when a consumer onSubmit prevents it', async () => {
        const onSubmit = vi.fn((event: FormEvent) => event.preventDefault())
        await renderFinder(
            <FinderForm onSubmit={onSubmit}>
                <FinderField attribute="artNumber" />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await page.getByRole('button', { name: 'Search' }).click()

        expect(onSubmit).toHaveBeenCalledTimes(1)
        await expect.element(submission()).toHaveTextContent('none')
    })

    it('says it searches by an ID only when another detail is filled', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="artNumber" />
                <FinderField attribute="firstName" />
                <FinderHint data-testid="hint" />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeEnabled()
        await expect.element(page.getByTestId('hint')).not.toBeInTheDocument()

        await userEvent.fill(page.getByLabelText('First name'), 'Jo')
        await expect
            .element(page.getByTestId('hint'))
            .toHaveTextContent('Searching by ART number only')
    })

    it('says nothing about the ID in a form with only an ID', async () => {
        await renderFinder(
            <FinderForm>
                <FinderField attribute="artNumber" />
                <FinderHint data-testid="hint" />
                <FinderSubmit />
            </FinderForm>
        )

        await userEvent.fill(page.getByLabelText('ART number'), 'ART-1')
        await expect
            .element(page.getByRole('button', { name: 'Search' }))
            .toBeEnabled()
        await expect.element(page.getByTestId('hint')).not.toBeInTheDocument()
    })

    it('tells field hooks the kind of value an attribute takes', async () => {
        const Kind = ({ attribute }: { attribute: string }) => (
            <li>{`${attribute} ${useFinderField(attribute).attribute?.kind};`}</li>
        )
        const Range = () => (
            <li>{`range ${useFinderRangeField('visit').attribute?.kind};`}</li>
        )
        await renderFinder(
            <FinderForm>
                <ul data-testid="kinds">
                    <Kind attribute="sex" />
                    <Kind attribute="firstName" />
                    <Kind attribute="dob" />
                    <Range />
                </ul>
            </FinderForm>
        )

        await expect
            .element(page.getByTestId('kinds'))
            .toHaveTextContent(
                'sex option;firstName text;dob date;range dateTime;'
            )
    })
})
