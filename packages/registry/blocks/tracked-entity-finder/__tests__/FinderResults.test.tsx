import React, { Component, type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import type { FinderPerson } from '../api/search'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderPerson, useFinderResults } from '../hooks'
import { FinderProvider } from '../provider/FinderProvider'
import { FinderItem } from '../results/FinderItem'
import { FinderList } from '../results/FinderList'
import { FinderResults } from '../results/FinderResults'
import { FinderEmpty, FinderError } from '../results/FinderStates'
import { FinderValue } from '../results/FinderValue'
import {
    createFakeServer,
    renderWithQueries,
    type FakeServer,
    type FakeServerOptions,
} from './finderTestSupport'
import { hivProgram } from './fixtures/program'

const entity = (id: string, attributes: Record<string, string> = {}) => ({
    trackedEntity: id,
    trackedEntityType: 'personType',
    orgUnit: 'ouA',
    programOwners: [{ orgUnit: 'ouOwner', program: 'hivProgram' }],
    attributes: Object.entries(attributes).map(([attribute, value]) => ({
        attribute,
        value,
    })),
})

const amina = entity('te1', {
    artNumber: 'A1',
    firstName: 'Amina',
    lastName: 'Bangura',
    dob: '1990-04-02',
    sex: 'F',
    weight: '61',
})

const answer = (
    people: ReadonlyArray<ReturnType<typeof entity>>,
    total = people.length,
    current = 1
) => ({
    trackedEntities: people,
    pager: { page: current, pageSize: 10, total },
})

const SearchForm = () => (
    <FinderForm>
        <FinderField attribute="artNumber" />
        <FinderField attribute="firstName" />
        <FinderSubmit />
    </FinderForm>
)

interface Setup {
    options?: FakeServerOptions
    onSelect?: (person: FinderPerson) => void
    results?: ReactNode
}

const ui = (
    server: FakeServer,
    program: string,
    onSelect: (person: FinderPerson) => void,
    results: ReactNode
) => (
    <FinderProvider
        program={program}
        client={server.client}
        onSelect={onSelect}
    >
        <SearchForm />
        {results}
    </FinderProvider>
)

const renderFinder = async ({
    options = {},
    onSelect = vi.fn(),
    results = <FinderResults data-testid="results" />,
}: Setup = {}) => {
    const server = createFakeServer(options)
    const screen = await renderWithQueries(
        ui(server, 'hivProgram', onSelect, results)
    )
    return { server, screen, onSelect }
}

const searchFor = async (artNumber: string) => {
    await userEvent.fill(
        page.getByRole('textbox', { name: 'ART number' }),
        artNumber
    )
    await page.getByRole('button', { name: 'Search' }).click()
}

interface CatchState {
    error?: Error
}

class Catch extends Component<{ children: ReactNode }, CatchState> {
    override state: CatchState = {}

    static getDerivedStateFromError(error: Error) {
        return { error }
    }

    override render() {
        return this.state.error ? (
            <output data-testid="caught">{this.state.error.message}</output>
        ) : (
            this.props.children
        )
    }
}

const searchRequests = (server: FakeServer) =>
    server.requests.filter(
        ({ resource }) => resource === 'tracker/trackedEntities'
    )

describe('FinderResults', () => {
    it('shows nothing before the first search', async () => {
        await renderFinder()

        await expect
            .element(page.getByRole('textbox', { name: 'ART number' }))
            .toBeEnabled()
        await expect
            .element(page.getByTestId('results'))
            .toHaveAttribute('aria-live', 'polite')
        expect(page.getByTestId('results').element().textContent).toBe('')
        expect(page.getByText('No one found').query()).toBeNull()
        expect(page.getByText('Searching…').query()).toBeNull()
        expect(page.getByRole('listitem').query()).toBeNull()
    })

    it('shows searching, then rows from displayInList attributes', async () => {
        const { server } = await renderFinder({
            options: { deferSearches: true },
        })

        await searchFor('A1')

        await expect.element(page.getByText('Searching…')).toBeVisible()
        server.pendingSearches[0].respond(answer([amina]))

        const row = page.getByRole('button', { name: /Amina/ })
        await expect.element(row).toBeVisible()
        await expect.element(row).toHaveTextContent('ART number')
        await expect.element(row).toHaveTextContent('A1')
        await expect.element(row).toHaveTextContent('Last name')
        await expect.element(row).toHaveTextContent('Bangura')
        await expect.element(row).toHaveTextContent('1990-04-02')
        // Option names, not codes.
        await expect.element(row).toHaveTextContent('Female')
        // Weight is not displayInList.
        expect(row.element().textContent).not.toContain('Weight')
        expect(page.getByText('Searching…').query()).toBeNull()
    })

    it('says No one found', async () => {
        await renderFinder()

        await searchFor('A1')

        await expect.element(page.getByText('No one found')).toBeVisible()
        expect(page.getByRole('list').query()).toBeNull()
    })

    it('says Too many matches. Add another detail. with no rows', async () => {
        await renderFinder({
            options: { searchResponse: answer([amina], 6) },
        })

        await searchFor('A1')

        await expect
            .element(page.getByText('Too many matches. Add another detail.'))
            .toBeVisible()
        expect(page.getByRole('listitem').query()).toBeNull()
    })

    it('shows a request error', async () => {
        await renderFinder({ options: { searchFails: true } })

        await searchFor('A1')

        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent("The search couldn't be completed")
    })

    it('shows a metadata load error before any search', async () => {
        await renderFinder({ options: { programFails: true } })

        await expect
            .element(page.getByTestId('results').getByRole('alert'))
            .toHaveTextContent("The search couldn't be loaded")
    })

    it('selects a person by click and by keyboard', async () => {
        const { onSelect } = await renderFinder({
            options: { searchResponse: answer([amina]) },
        })

        await searchFor('A1')
        const row = page.getByRole('button', { name: /Amina/ })
        await row.click()

        const expected: FinderPerson = {
            trackedEntity: 'te1',
            trackedEntityType: 'personType',
            orgUnit: 'ouA',
            programOwner: 'ouOwner',
            attributes: {
                artNumber: 'A1',
                firstName: 'Amina',
                lastName: 'Bangura',
                dob: '1990-04-02',
                sex: 'F',
                weight: '61',
            },
        }
        expect(onSelect).toHaveBeenCalledTimes(1)
        expect(onSelect).toHaveBeenLastCalledWith(expected)

        row.element().focus()
        await userEvent.keyboard('{Enter}')
        expect(onSelect).toHaveBeenCalledTimes(2)
        await userEvent.keyboard(' ')
        expect(onSelect).toHaveBeenCalledTimes(3)
        expect(onSelect).toHaveBeenLastCalledWith(expected)
    })

    it('pages with previous and next', async () => {
        const { server } = await renderFinder({
            options: {
                program: { ...hivProgram, maxTeiCountToReturn: 0 },
                answerSearch: (request) => {
                    const current = Number(request.params?.page ?? 1)
                    return current === 1
                        ? answer(
                              Array.from({ length: 10 }, (_, index) =>
                                  entity(`p1-${index}`, {
                                      firstName: `First${index}`,
                                  })
                              ),
                              12
                          )
                        : answer(
                              [
                                  entity('p2-0', { firstName: 'Zainab' }),
                                  entity('p2-1', { firstName: 'Yusuf' }),
                              ],
                              12,
                              2
                          )
                },
            },
        })

        await searchFor('A1')
        await expect.element(page.getByText('First0')).toBeVisible()
        const previous = page.getByRole('button', { name: 'Previous' })
        const next = page.getByRole('button', { name: 'Next' })
        await expect.element(previous).toBeDisabled()

        await next.click()
        await expect.element(page.getByText('Zainab')).toBeVisible()
        expect(page.getByText('First0').query()).toBeNull()
        await expect.element(next).toBeDisabled()
        expect(searchRequests(server).at(-1)?.params?.page).toBe(2)

        await previous.click()
        await expect.element(page.getByText('First0')).toBeVisible()
        expect(page.getByText('Zainab').query()).toBeNull()
    })

    it('hides pagination when there is one page', async () => {
        await renderFinder({ options: { searchResponse: answer([amina]) } })

        await searchFor('A1')
        await expect
            .element(page.getByRole('button', { name: /Amina/ }))
            .toBeVisible()
        expect(page.getByRole('navigation').query()).toBeNull()
    })

    it('renders only what is composed', async () => {
        await renderFinder({
            options: { searchResponse: answer([]) },
            results: (
                <FinderResults data-testid="custom">
                    <FinderList>
                        <FinderItem>
                            <FinderValue attribute="artNumber" />
                        </FinderItem>
                    </FinderList>
                </FinderResults>
            ),
        })

        await searchFor('A1')
        await expect
            .poll(() => page.getByTestId('custom').element().textContent)
            .toBe('')
        expect(page.getByText('No one found').query()).toBeNull()
        expect(page.getByText('Searching…').query()).toBeNull()
    })

    it('replaces default text with children', async () => {
        await renderFinder({
            results: (
                <FinderResults>
                    <FinderEmpty>Nobody</FinderEmpty>
                </FinderResults>
            ),
        })

        await searchFor('A1')
        await expect.element(page.getByText('Nobody')).toBeVisible()
        expect(page.getByText('No one found').query()).toBeNull()
    })

    it('replaces the error text with children', async () => {
        await renderFinder({
            options: { searchFails: true },
            results: (
                <FinderResults>
                    <FinderError>Try again later</FinderError>
                </FinderResults>
            ),
        })

        await searchFor('A1')
        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent('Try again later')
    })

    it('shows a non-displayInList attribute through FinderValue', async () => {
        await renderFinder({
            options: { searchResponse: answer([amina]) },
            results: (
                <FinderResults>
                    <FinderList>
                        <FinderItem>
                            Weight: <FinderValue attribute="weight" />
                        </FinderItem>
                    </FinderList>
                </FinderResults>
            ),
        })

        await searchFor('A1')
        await expect
            .element(page.getByRole('button', { name: 'Weight: 61' }))
            .toBeVisible()
    })

    it('gives custom content the person through useFinderPerson', async () => {
        const Name = () => {
            const person = useFinderPerson()
            return (
                <span>
                    {person.attributes.firstName} {person.attributes.lastName} (
                    {person.trackedEntity})
                </span>
            )
        }
        await renderFinder({
            options: { searchResponse: answer([amina]) },
            results: (
                <FinderResults>
                    <FinderList className="custom-list">
                        <Name />
                    </FinderList>
                </FinderResults>
            ),
        })

        await searchFor('A1')
        await expect
            .element(page.getByRole('listitem'))
            .toHaveTextContent('Amina Bangura (te1)')
        await expect.element(page.getByRole('list')).toHaveClass('custom-list')
    })

    it('takes children, not a render function', () => {
        const element = (
            <FinderList>
                {/* @ts-expect-error React 18's ReactNode excludes functions. */}
                {(person: FinderPerson) => person.trackedEntity}
            </FinderList>
        )
        expect(element.type).toBe(FinderList)
    })

    it('throws when useFinderPerson is used outside FinderList', async () => {
        const Stray = () => {
            useFinderPerson()
            return null
        }
        const error = vi.spyOn(console, 'error').mockImplementation(() => {})
        await renderFinder({
            results: (
                <Catch>
                    <Stray />
                </Catch>
            ),
        })
        await expect
            .element(page.getByTestId('caught'))
            .toHaveTextContent(/inside FinderList/)
        error.mockRestore()
    })

    it("drops an old program's in-flight search when the program changes", async () => {
        const onSelect = vi.fn()
        const server = createFakeServer({ deferSearches: true })
        const screen = await renderWithQueries(
            ui(server, 'hivProgram', onSelect, <FinderResults />)
        )

        await searchFor('A1')
        await expect.element(page.getByText('Searching…')).toBeVisible()

        await screen.rerender(
            ui(server, 'otherProgram', onSelect, <FinderResults />)
        )
        server.pendingSearches[0].respond(answer([amina]))

        await expect
            .element(page.getByRole('textbox', { name: 'ART number' }))
            .toBeEnabled()
        await expect
            .element(page.getByRole('textbox', { name: 'ART number' }))
            .toHaveValue('')
        expect(page.getByText('Searching…').query()).toBeNull()
        // Give the old answer a chance to land; it must not.
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(page.getByText('Amina').query()).toBeNull()
        expect(page.getByText('No one found').query()).toBeNull()
        expect(searchRequests(server)).toHaveLength(1)
    })

    it('shows only the newest answer after a double submit', async () => {
        const { server } = await renderFinder({
            options: { deferSearches: true },
        })

        await searchFor('A1')
        await page.getByRole('button', { name: 'Search' }).click()
        await expect.poll(() => server.pendingSearches.length).toBe(2)

        server.pendingSearches[0].respond(
            answer([entity('old', { firstName: 'Older' })])
        )
        await new Promise((resolve) => setTimeout(resolve, 50))
        expect(page.getByText('Older').query()).toBeNull()
        await expect.element(page.getByText('Searching…')).toBeVisible()

        server.pendingSearches[1].respond(
            answer([entity('new', { firstName: 'Newest' })])
        )
        await expect.element(page.getByText('Newest')).toBeVisible()
        expect(page.getByText('Older').query()).toBeNull()
        expect(page.getByRole('listitem').all()).toHaveLength(1)
    })

    it('exposes the results through useFinderResults', async () => {
        const Probe = () => {
            const results = useFinderResults()
            return (
                <output data-testid="probe">
                    {`${results.status} ${results.page} ${results.people.length} ${results.hasPrevious} ${results.hasNext}`}
                </output>
            )
        }
        await renderFinder({
            options: { searchResponse: answer([amina]) },
            results: <Probe />,
        })

        await expect
            .element(page.getByTestId('probe'))
            .toHaveTextContent('idle 1 0 false false')
        await searchFor('A1')
        await expect
            .element(page.getByTestId('probe'))
            .toHaveTextContent('results 1 1 false false')
    })
})
