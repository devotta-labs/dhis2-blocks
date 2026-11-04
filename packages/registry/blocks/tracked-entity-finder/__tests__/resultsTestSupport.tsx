import React, { type ReactNode } from 'react'
import { page, userEvent } from 'vitest/browser'
import type { FinderPerson } from '../api/search'
import { FinderField } from '../form/FinderField'
import { FinderForm } from '../form/FinderForm'
import { FinderSubmit } from '../form/FinderSubmit'
import { FinderProvider } from '../provider/FinderProvider'
import { FinderResults } from '../results/FinderResults'
import {
    createFakeServer,
    renderWithQueries,
    type FakeServer,
    type FakeServerOptions,
} from './finderTestSupport'

export const entity = (
    id: string,
    attributes: Record<string, string> = {}
) => ({
    trackedEntity: id,
    trackedEntityType: 'personType',
    orgUnit: 'ouA',
    programOwners: [{ orgUnit: 'ouOwner', program: 'hivProgram' }],
    attributes: Object.entries(attributes).map(([attribute, value]) => ({
        attribute,
        value,
    })),
})

export const amina = entity('te1', {
    artNumber: 'A1',
    firstName: 'Amina',
    lastName: 'Bangura',
    dob: '1990-04-02',
    sex: 'F',
    weight: '61',
})

export const answer = (
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

export const ui = (
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

export const renderFinder = async ({
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

export const searchFor = async (artNumber: string) => {
    await userEvent.fill(
        page.getByRole('textbox', { name: 'ART number' }),
        artNumber
    )
    await page.getByRole('button', { name: 'Search' }).click()
}

/** Lets any follow-up request (a refetch on mount or focus) go out. */
export const settle = () => new Promise((resolve) => setTimeout(resolve, 100))

export const searchRequests = (server: FakeServer) =>
    server.requests.filter(
        ({ resource }) => resource === 'tracker/trackedEntities'
    )
