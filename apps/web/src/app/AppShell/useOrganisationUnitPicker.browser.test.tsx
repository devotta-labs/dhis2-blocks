import type {
    ResourceRequest,
    WorkingListClient,
} from '@/components/working-list/api/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { act } from 'react'
import type { ComponentProps } from 'react'
import { render } from 'vitest-browser-react'
import { OrganisationUnitSelectorContent } from '../OrganisationUnitSelectorContent'
import { useOrganisationUnitPicker } from './useOrganisationUnitPicker'

const roots = [
    { id: 'capture', displayName: 'Capture', path: '/global/capture' },
]
const selected = {
    id: 'selected',
    displayName: 'Selected',
    path: '/global/capture/selected',
}
const Tree: NonNullable<
    ComponentProps<typeof OrganisationUnitSelectorContent>['treeComponent']
> = ({ roots, filter, expanded, selected, handleExpand, handleCollapse }) => (
    <div data-testid="tree">
        <output aria-label="Roots">{roots.join(',')}</output>
        <output aria-label="Filter">{filter.join(',')}</output>
        <output aria-label="Selection">{selected.join(',')}</output>
        <button
            data-testid="branch"
            aria-expanded={expanded.includes('/capture')}
            onClick={() =>
                expanded.includes('/capture')
                    ? handleCollapse({ path: '/capture' })
                    : handleExpand({ path: '/capture' })
            }
        >
            Branch
        </button>
    </div>
)

const Harness = ({
    client,
    programId = 'a',
    orgUnitId = selected.id,
}: {
    client: WorkingListClient
    programId?: string
    orgUnitId?: string
}) => {
    const picker = useOrganisationUnitPicker({
        client,
        programId,
        orgUnitId,
        roots,
        selected,
        onSelect: () => undefined,
    })
    return (
        <>
            <button onClick={picker.open}>Open</button>
            <button onClick={picker.close}>Close</button>
            <output aria-label="Open">{String(picker.isOpen)}</output>
            <OrganisationUnitSelectorContent
                {...picker.contentProps}
                treeComponent={Tree}
            />
        </>
    )
}

const tick = async (milliseconds: number) => {
    await act(async () => {
        await vi.advanceTimersByTimeAsync(milliseconds)
    })
}

const page = (id: string, pageNumber = 1, total = 1) => ({
    organisationUnits: [{ id, displayName: id, path: `/global/capture/${id}` }],
    pager: { page: pageNumber, pageSize: 50, total },
})

const setup = async (client: WorkingListClient) => {
    const queryClient = new QueryClient()
    const view = (programId = 'a', orgUnitId = selected.id) => (
        <QueryClientProvider client={queryClient}>
            <Harness
                client={client}
                programId={programId}
                orgUnitId={orgUnitId}
            />
        </QueryClientProvider>
    )
    const screen = await render(view())
    return { screen, view }
}

describe('OU picker lifecycle at the query and tree boundary', () => {
    beforeEach(() =>
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    )
    afterEach(() => vi.useRealTimers())

    it('debounces exactly 500ms and cancels pending work on close/reopen and context changes', async () => {
        const requests: ResourceRequest[] = []
        const client: WorkingListClient = {
            query: async (request, schema) => {
                requests.push(request)
                return schema.parse(page('match'))
            },
            mutate: async () => {
                throw new Error('Unexpected mutation')
            },
        }
        const { screen, view } = await setup(client)
        const input = screen.getByPlaceholder('Search')
        await expect
            .element(screen.getByLabelText('Roots'))
            .toHaveTextContent('capture')
        await expect
            .element(screen.getByLabelText('Filter'))
            .toHaveTextContent('')
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        await input.fill('  Clinic  ')
        await tick(499)
        expect(requests).toEqual([])
        await tick(1)
        expect(requests).toEqual([
            expect.objectContaining({
                params: expect.objectContaining({
                    query: '  Clinic  ',
                    page: 1,
                    pageSize: 50,
                    withinUserSearchHierarchy: true,
                }),
            }),
        ])
        await tick(1)

        await input.fill('cancelled')
        await tick(250)
        await screen.getByRole('button', { name: 'Close' }).click()
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        await tick(500)
        expect(requests).toHaveLength(1)
        await expect.element(input).toHaveValue('')
        await expect
            .element(screen.getByLabelText('Roots'))
            .toHaveTextContent('capture')

        for (const [programId, orgUnitId] of [
            ['b', selected.id],
            ['b', 'other-ou'],
        ]) {
            await input.fill('old context')
            await screen.rerender(view(programId, orgUnitId))
            await tick(500)
            expect(requests).toHaveLength(1)
            await expect.element(input).toHaveValue('')
            await expect
                .element(screen.getByLabelText('Open', { exact: true }))
                .toHaveTextContent('false')
            await screen
                .getByRole('button', { name: 'Open', exact: true })
                .click()
        }
    })

    it('ignores late search results after a newer search and after close/reopen', async () => {
        const pending = new Map<
            string,
            (value: ReturnType<typeof page>) => void
        >()
        const client: WorkingListClient = {
            query: async (request, schema) =>
                schema.parse(
                    await new Promise<ReturnType<typeof page>>((resolve) => {
                        pending.set(String(request.params?.query), resolve)
                    })
                ),
            mutate: async () => {
                throw new Error('Unexpected mutation')
            },
        }
        const { screen } = await setup(client)
        const input = screen.getByPlaceholder('Search')
        const visibleRoots = screen.getByLabelText('Roots')
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        await input.fill('old')
        await tick(500)
        expect(pending.has('old')).toBe(true)
        await input.fill('latest')
        await tick(499)
        expect(pending.has('latest')).toBe(false)
        await tick(1)
        expect(pending.has('latest')).toBe(true)
        pending.get('latest')!(page('latest-match'))
        await tick(1)
        await expect.element(visibleRoots).toHaveTextContent('latest-match')
        pending.get('old')!(page('stale-match'))
        await tick(1)
        await expect.element(visibleRoots).toHaveTextContent('latest-match')

        await input.fill('closed')
        await tick(500)
        expect(pending.has('closed')).toBe(true)
        await screen.getByRole('button', { name: 'Close' }).click()
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        pending.get('closed')!(page('closed-match'))
        await tick(1)
        await expect.element(input).toHaveValue('')
        await expect.element(visibleRoots).toHaveTextContent('capture')
    })

    it('shows pending/error/retry states from real query results', async () => {
        let resolveRequest: (
            value: ReturnType<typeof page> | null
        ) => void = () => undefined
        let attempts = 0
        const client: WorkingListClient = {
            query: async (_request, schema) => {
                attempts++
                const response = await new Promise<ReturnType<
                    typeof page
                > | null>((resolve) => {
                    resolveRequest = resolve
                })
                return schema.parse(response)
            },
            mutate: async () => {
                throw new Error('Unexpected mutation')
            },
        }
        const { screen } = await setup(client)
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        await screen.getByPlaceholder('Search').fill('clinic')
        await tick(500)
        await expect
            .element(screen.getByRole('status', { name: 'Loading' }))
            .toBeVisible()
        resolveRequest(null)
        await tick(1)
        await expect
            .element(screen.getByText('Could not search organisation units'))
            .toBeVisible()
        await screen.getByRole('button', { name: 'Try again' }).click()
        expect(attempts).toBe(2)
        resolveRequest(page('result'))
        await tick(1)
        await expect
            .element(screen.getByLabelText('Roots'))
            .toHaveTextContent('result')
        await expect
            .element(screen.getByText('Could not search organisation units'))
            .not.toBeInTheDocument()
    })

    it('preserves expansion, selection and focus across append and load-more retry, then resets for a new context', async () => {
        let resolvePage: (value: ReturnType<typeof page> | null) => void = () =>
            undefined
        const client: WorkingListClient = {
            query: async (request, schema) => {
                if (request.params?.page === 1)
                    return schema.parse(page('capture', 1, 100))
                return schema.parse(
                    await new Promise<ReturnType<typeof page> | null>(
                        (resolve) => {
                            resolvePage = resolve
                        }
                    )
                )
            },
            mutate: async () => {
                throw new Error('Unexpected mutation')
            },
        }
        const { screen, view } = await setup(client)
        await screen.getByRole('button', { name: 'Open', exact: true }).click()
        await screen.getByPlaceholder('Search').fill('clinic')
        await tick(500)
        await tick(1)
        const branch = screen.getByTestId('branch')
        await branch.click()
        await expect.element(branch).toHaveAttribute('aria-expanded', 'false')
        await screen.getByRole('button', { name: 'Show more' }).click()
        resolvePage(null)
        await tick(1)
        await expect
            .element(screen.getByText('Could not load more organisation units'))
            .toBeVisible()
        await expect.element(branch).toHaveAttribute('aria-expanded', 'false')
        await screen.getByRole('button', { name: 'Try again' }).click()
        branch.element().focus()
        resolvePage(page('appended', 2, 100))
        await tick(1)
        await expect
            .element(screen.getByLabelText('Roots'))
            .toHaveTextContent('capture,appended')
        await expect.element(branch).toHaveFocus()
        await expect.element(branch).toHaveAttribute('aria-expanded', 'false')
        await expect
            .element(screen.getByLabelText('Selection'))
            .toHaveTextContent(selected.path)
        await expect
            .element(screen.getByRole('button', { name: 'Show more' }))
            .not.toBeInTheDocument()
        await screen.rerender(view('b'))
        await expect.element(branch).toHaveAttribute('aria-expanded', 'true')
        await expect
            .element(screen.getByLabelText('Roots'))
            .toHaveTextContent('capture')
    })
})
