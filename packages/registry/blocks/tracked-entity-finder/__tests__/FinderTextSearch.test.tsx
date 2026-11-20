import React from 'react'
import { page } from 'vitest/browser'
import { useFinderTextSearch } from '../index'
import {
    createFakeServer,
    FinderTestProvider,
    renderWithQueries,
} from './finderTestSupport'
import { hivProgram } from './fixtures/program'
import { amina, answer, entity, searchRequests } from './resultsTestSupport'

const clinic = 'ClinicA0001'
const names = { firstName: 'Amina', lastName: 'Bangura' }
const nameSearchProgram = {
    ...hivProgram,
    attributes: hivProgram.attributes.map((attribute) =>
        attribute.id === 'lastName'
            ? { ...attribute, searchable: true }
            : attribute
    ),
}
const singleDetailProgram = {
    ...nameSearchProgram,
    minAttributesRequiredToSearch: 1,
}

function Search({ match }: { match: 'all' | 'any' }) {
    const search = useFinderTextSearch(names, match)
    return (
        <>
            <button onClick={search.submit} disabled={!search.canSearch}>
                Search
            </button>
            <p role="status">{search.status}</p>
            {search.people.map((person) => (
                <button
                    key={person.trackedEntity}
                    onClick={() => search.select(person)}
                >
                    {person.trackedEntity}
                </button>
            ))}
        </>
    )
}

const button = () => page.getByRole('button', { name: 'Search' })
const status = () => page.getByRole('status')

describe('one-field Finder search', () => {
    it('combines AND filters into one clinic-scoped request', async () => {
        const server = createFakeServer({
            program: nameSearchProgram,
            searchResponse: answer([amina]),
        })
        const onSelect = vi.fn()
        await renderWithQueries(
            <FinderTestProvider
                server={server}
                program="hivProgram"
                orgUnit={clinic}
                onSelect={onSelect}
            >
                <Search match="all" />
            </FinderTestProvider>
        )
        await expect.element(button()).toBeEnabled()
        expect(searchRequests(server)).toHaveLength(0)
        await button().click()
        await page.getByRole('button', { name: 'te1' }).click()
        expect(onSelect).toHaveBeenCalledWith(
            expect.objectContaining({ trackedEntity: 'te1' })
        )
        expect(searchRequests(server).map(({ params }) => params)).toEqual([
            expect.objectContaining({
                filter: ['firstName:like:Amina', 'lastName:like:Bangura'],
                orgUnitMode: 'SELECTED',
                orgUnits: clinic,
            }),
        ])
    })

    it('waits for every OR branch and deduplicates by tracked entity', async () => {
        const server = createFakeServer({
            program: singleDetailProgram,
            deferSearches: true,
        })
        await renderWithQueries(
            <FinderTestProvider
                server={server}
                program="hivProgram"
                orgUnit={clinic}
                onSelect={vi.fn()}
            >
                <Search match="any" />
            </FinderTestProvider>
        )
        await expect.element(button()).toBeEnabled()
        await button().click()
        await vi.waitFor(() => expect(server.pendingSearches).toHaveLength(2))
        expect(searchRequests(server).map(({ params }) => params)).toEqual([
            expect.objectContaining({
                filter: ['firstName:like:Amina'],
                orgUnitMode: 'SELECTED',
                orgUnits: clinic,
            }),
            expect.objectContaining({
                filter: ['lastName:like:Bangura'],
                orgUnitMode: 'SELECTED',
                orgUnits: clinic,
            }),
        ])
        server.pendingSearches[0].respond(answer([amina]))
        await expect.element(status()).toHaveTextContent('searching')
        await expect
            .element(page.getByRole('button', { name: 'te1' }))
            .not.toBeInTheDocument()
        server.pendingSearches[1].respond(answer([amina, entity('te2')]))
        await expect
            .element(page.getByRole('button', { name: 'te1' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'te2' }))
            .toBeVisible()
    })

    it.each([
        { orgUnit: clinic, program: nameSearchProgram },
        { orgUnit: undefined, program: singleDetailProgram },
    ])(
        'blocks OR if any branch is not permitted or no clinic is selected ($orgUnit)',
        async ({ orgUnit, program }) => {
            const server = createFakeServer({ program })
            await renderWithQueries(
                <FinderTestProvider
                    server={server}
                    program="hivProgram"
                    orgUnit={orgUnit}
                    onSelect={vi.fn()}
                >
                    <Search match="any" />
                </FinderTestProvider>
            )
            await expect.element(status()).toHaveTextContent('idle')
            await expect.element(button()).toBeDisabled()
            expect(searchRequests(server)).toHaveLength(0)
        }
    )

    it('asks to refine when the deduplicated union exceeds the program limit', async () => {
        const server = createFakeServer({
            program: { ...singleDetailProgram, maxTeiCountToReturn: 1 },
            deferSearches: true,
        })
        await renderWithQueries(
            <FinderTestProvider
                server={server}
                program="hivProgram"
                orgUnit={clinic}
                onSelect={vi.fn()}
            >
                <Search match="any" />
            </FinderTestProvider>
        )
        await expect.element(button()).toBeEnabled()
        await button().click()
        await vi.waitFor(() => expect(server.pendingSearches).toHaveLength(2))
        server.pendingSearches[0].respond(answer([amina]))
        server.pendingSearches[1].respond(answer([entity('te2')]))
        await expect.element(status()).toHaveTextContent('too-many')
        await expect
            .element(page.getByRole('button', { name: 'te1' }))
            .not.toBeInTheDocument()
    })
})
