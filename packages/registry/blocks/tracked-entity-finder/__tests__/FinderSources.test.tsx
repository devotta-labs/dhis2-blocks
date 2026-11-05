import { CustomDataProvider } from '@dhis2/app-runtime'
import React, { act, type ComponentProps } from 'react'
import { page } from 'vitest/browser'
import { z } from 'zod'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { useFinderProgram, useFinderResults } from '../hooks'
import { FinderProvider } from '../provider/FinderProvider'
import { FinderResults } from '../results/FinderResults'
import {
    createFakeServer,
    renderWithQueries,
    type FakeServer,
} from './finderTestSupport'
import { hivProgram } from './fixtures/program'
import {
    amina,
    answer,
    entity,
    searchFor,
    searchRequests,
    ui,
} from './resultsTestSupport'

const runtimeData = (
    server: FakeServer
): ComponentProps<typeof CustomDataProvider>['data'] =>
    Object.fromEntries(
        ['programs', 'system/info', 'tracker/trackedEntities'].map(
            (resource) => [
                resource,
                async () =>
                    z.json().parse(
                        (
                            await server.engine.query({
                                result: { resource },
                            })
                        ).result
                    ),
            ]
        )
    )

const Probe = ({ id }: { id: string }) => {
    const program = useFinderProgram()
    const results = useFinderResults()
    return (
        <output data-testid={id}>
            {program.name} {results.status} {results.page}
        </output>
    )
}

it.each(['custom', 'runtime'] as const)(
    'resets a %s source before an old search can display or select',
    async (kind) => {
        const oldSource = createFakeServer({ deferSearches: true })
        const newSource = createFakeServer({
            program: { ...hivProgram, name: 'Second source' },
            info: { calendar: 'ethiopian', dateFormat: 'DD-MM-YYYY' },
            searchResponse: answer([
                entity('new', { firstName: 'New person', dob: '2024-05-23' }),
            ]),
        })
        const onSelect = vi.fn()
        const ui = (server: FakeServer) => {
            const finder = (
                <FinderProvider
                    program="hivProgram"
                    client={kind === 'custom' ? server.client : undefined}
                    onSelect={onSelect}
                >
                    <FinderForm>
                        <FinderField attribute="artNumber" />
                        <FinderSubmit />
                    </FinderForm>
                    <Probe id="state" />
                    <FinderResults />
                </FinderProvider>
            )
            return kind === 'custom' ? (
                finder
            ) : (
                <CustomDataProvider data={runtimeData(server)}>
                    {finder}
                </CustomDataProvider>
            )
        }
        const screen = await renderWithQueries(ui(oldSource))
        await searchFor('A1')
        await expect.poll(() => oldSource.pendingSearches.length).toBe(1)
        await screen.rerender(ui(newSource))
        await expect
            .element(page.getByTestId('state'))
            .toHaveTextContent('Second source idle 1')
        await expect
            .element(page.getByRole('textbox', { name: 'ART number' }))
            .toHaveValue('')
        await act(async () => {
            oldSource.pendingSearches[0].respond(answer([amina]))
        })
        expect(page.getByRole('button', { name: /Amina/ }).query()).toBeNull()
        expect(searchRequests(newSource)).toHaveLength(0)
        expect(onSelect).not.toHaveBeenCalled()
        await searchFor('A1')
        await expect.element(page.getByText('New person')).toBeVisible()
        await expect.element(page.getByText('15-09-2016')).toBeVisible()
        await page.getByRole('button', { name: /New person/ }).click()
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ trackedEntity: 'new' })
        )
        expect(searchRequests(oldSource)).toHaveLength(1)
        expect(searchRequests(newSource)).toHaveLength(1)
    }
)

it('shares metadata for one real runtime engine but not for another engine', async () => {
    const first = createFakeServer({
        program: { ...hivProgram, name: 'First source' },
    })
    const second = createFakeServer({
        program: { ...hivProgram, name: 'Second source' },
    })
    const finder = (id: string) => (
        <FinderProvider program="hivProgram" onSelect={vi.fn()}>
            <Probe id={id} />
        </FinderProvider>
    )
    await renderWithQueries(
        <>
            <CustomDataProvider data={runtimeData(first)}>
                {finder('first')}
                {finder('same')}
            </CustomDataProvider>
            <CustomDataProvider data={runtimeData(second)}>
                {finder('second')}
            </CustomDataProvider>
        </>
    )
    for (const id of ['first', 'same']) {
        await expect
            .element(page.getByTestId(id))
            .toHaveTextContent('First source idle 1')
    }
    await expect
        .element(page.getByTestId('second'))
        .toHaveTextContent('Second source idle 1')
    for (const source of [first, second]) {
        expect(
            source.requests.filter(({ resource }) => resource === 'programs')
        ).toHaveLength(1)
        expect(
            source.requests.filter(({ resource }) => resource === 'system/info')
        ).toHaveLength(1)
    }
})

it('drops a previous page and resets pagination when the source changes', async () => {
    const first = createFakeServer({
        program: { ...hivProgram, maxTeiCountToReturn: 0 },
        deferSearches: true,
    })
    const second = createFakeServer()
    const onSelect = vi.fn()
    const results = (
        <>
            <Probe id="page-state" />
            <FinderResults />
        </>
    )
    const screen = await renderWithQueries(
        ui(first, 'hivProgram', onSelect, results)
    )
    await searchFor('A1')
    await expect.poll(() => first.pendingSearches.length).toBe(1)
    first.pendingSearches[0].respond(
        answer(
            Array.from({ length: 10 }, (_, index) =>
                entity(`first-${index}`, { firstName: `First ${index}` })
            ),
            12
        )
    )
    await expect
        .element(page.getByText('First 0', { exact: true }))
        .toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()
    await expect.poll(() => first.pendingSearches.length).toBe(2)
    await expect
        .element(page.getByTestId('page-state'))
        .toHaveTextContent('results 2')
    await expect
        .element(page.getByText('First 0', { exact: true }))
        .toBeVisible()
    await screen.rerender(ui(second, 'hivProgram', onSelect, results))
    await expect
        .element(page.getByTestId('page-state'))
        .toHaveTextContent('idle 1')
    await act(async () => {
        first.pendingSearches[1].respond(answer([amina], 12, 2))
    })
    expect(page.getByText('First 0', { exact: true }).query()).toBeNull()
    expect(page.getByRole('button', { name: /Amina/ }).query()).toBeNull()
    expect(onSelect).not.toHaveBeenCalled()
    expect(searchRequests(second)).toHaveLength(0)
    await searchFor('A1')
    await expect.element(page.getByText('No one found')).toBeVisible()
    expect(searchRequests(second)[0].params?.page).toBe(1)
})
