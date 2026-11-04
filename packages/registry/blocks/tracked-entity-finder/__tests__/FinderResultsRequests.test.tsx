import React from 'react'
import { page } from 'vitest/browser'
import { useFinderResults } from '../hooks'
import { FinderResults } from '../results/FinderResults'
import { createFakeServer, renderWithQueries } from './finderTestSupport'
import { hivProgram } from './fixtures/program'
import {
    amina,
    answer,
    entity,
    renderFinder,
    searchFor,
    searchRequests,
    settle,
    ui,
} from './resultsTestSupport'

describe('FinderResults paging and requests', () => {
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
        await settle()
        expect(searchRequests(server)).toHaveLength(1)
        const previous = page.getByRole('button', { name: 'Previous' })
        const next = page.getByRole('button', { name: 'Next' })
        await expect.element(previous).toBeDisabled()

        await next.click()
        await expect.element(page.getByText('Zainab')).toBeVisible()
        expect(page.getByText('First0').query()).toBeNull()
        await expect.element(next).toBeDisabled()
        await settle()
        expect(searchRequests(server)).toHaveLength(2)
        expect(searchRequests(server).at(-1)?.params?.page).toBe(2)

        await previous.click()
        await expect.element(page.getByText('First0')).toBeVisible()
        expect(page.getByText('Zainab').query()).toBeNull()
        // Page 1 is cached: going back sends nothing.
        await settle()
        expect(searchRequests(server)).toHaveLength(2)
        await expect.element(next).toBeEnabled()
    })

    it('goes back to the previous page after a later page fails', async () => {
        await renderFinder({
            options: {
                program: { ...hivProgram, maxTeiCountToReturn: 0 },
                answerSearch: (request) => {
                    if (Number(request.params?.page ?? 1) > 1) {
                        throw Object.assign(new Error('Search failed'), {
                            httpStatusCode: 400,
                        })
                    }
                    return answer(
                        Array.from({ length: 10 }, (_, index) =>
                            entity(`p1-${index}`, {
                                firstName: `First${index}`,
                            })
                        ),
                        12
                    )
                },
            },
        })

        await searchFor('A1')
        await expect.element(page.getByText('First0')).toBeVisible()
        await page.getByRole('button', { name: 'Next' }).click()
        await expect
            .element(page.getByRole('alert'))
            .toHaveTextContent("The search couldn't be completed")

        const previous = page.getByRole('button', { name: 'Previous' })
        await expect.element(previous).toBeEnabled()
        await expect
            .element(page.getByRole('button', { name: 'Next' }))
            .toBeDisabled()
        await previous.click()
        await expect.element(page.getByText('First0')).toBeVisible()
    })

    it('sends exactly one request to show results', async () => {
        const { server } = await renderFinder({
            options: { searchResponse: answer([amina]) },
        })

        await searchFor('A1')
        await expect
            .element(page.getByRole('button', { name: /Amina/ }))
            .toBeVisible()
        await settle()
        expect(searchRequests(server)).toHaveLength(1)

        // Focusing the window again does not run the search again.
        window.dispatchEvent(new Event('visibilitychange'))
        window.dispatchEvent(new Event('focus'))
        await settle()
        expect(searchRequests(server)).toHaveLength(1)
    })

    it('hides pagination when there is one page', async () => {
        await renderFinder({ options: { searchResponse: answer([amina]) } })

        await searchFor('A1')
        await expect
            .element(page.getByRole('button', { name: /Amina/ }))
            .toBeVisible()
        expect(page.getByRole('navigation').query()).toBeNull()
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

    it('asks the server again for the same search after the finder remounts', async () => {
        const onSelect = vi.fn()
        const server = createFakeServer()
        const screen = await renderWithQueries(
            ui(server, 'hivProgram', onSelect, <FinderResults />)
        )

        await searchFor('A1')
        await expect.element(page.getByText('No one found')).toBeVisible()
        expect(searchRequests(server)).toHaveLength(1)

        await screen.rerender(<></>)
        await screen.rerender(
            ui(server, 'hivProgram', onSelect, <FinderResults />)
        )
        await expect
            .element(page.getByRole('textbox', { name: 'ART number' }))
            .toBeEnabled()
        expect(page.getByText('No one found').query()).toBeNull()

        // Someone may have been registered since: never reuse the answer.
        await searchFor('A1')
        await expect.poll(() => searchRequests(server)).toHaveLength(2)
        await expect.element(page.getByText('No one found')).toBeVisible()
    })

    it('ignores next and previous when there is no such page', async () => {
        const Probe = () => {
            const results = useFinderResults()
            return (
                <>
                    <output data-testid="probe">
                        {`${results.status} ${results.page}`}
                    </output>
                    <button type="button" onClick={results.next}>
                        Force next
                    </button>
                    <button type="button" onClick={results.previous}>
                        Force previous
                    </button>
                </>
            )
        }
        const { server } = await renderFinder({
            options: { searchResponse: answer([amina]) },
            results: <Probe />,
        })
        const probe = page.getByTestId('probe')

        await expect.element(probe).toHaveTextContent('idle 1')
        await page.getByRole('button', { name: 'Force next' }).click()
        await expect.element(probe).toHaveTextContent('idle 1')

        await searchFor('A1')
        await expect.element(probe).toHaveTextContent('results 1')
        await page.getByRole('button', { name: 'Force next' }).click()
        await page.getByRole('button', { name: 'Force previous' }).click()
        await settle()
        await expect.element(probe).toHaveTextContent('results 1')
        expect(searchRequests(server)).toHaveLength(1)
    })
})
