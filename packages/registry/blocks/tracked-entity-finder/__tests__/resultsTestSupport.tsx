import React, { act, type ReactNode } from 'react'
import { notifyManager, type QueryClient } from '@tanstack/react-query'
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
    return { server, screen, onSelect, queryClient: screen.queryClient }
}

export const searchFor = async (artNumber: string) => {
    await userEvent.fill(
        page.getByRole('textbox', { name: 'ART number' }),
        artNumber
    )
    await page.getByRole('button', { name: 'Search' }).click()
}

/** Drain query notifications and the requests they started, then commit React updates. */
export const settle = async (queryClient: QueryClient) => {
    await act(async () => {
        await new Promise<void>((done) => notifyManager.schedule(done))
        await Promise.all(
            queryClient
                .getQueryCache()
                .getAll()
                .filter((query) => query.state.fetchStatus === 'fetching')
                .map((query) => query.promise)
        )
        await new Promise<void>((done) => notifyManager.schedule(done))
    })
}

export const searchRequests = (server: FakeServer) =>
    server.requests.filter(
        ({ resource }) => resource === 'tracker/trackedEntities'
    )
