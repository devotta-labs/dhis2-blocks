import { CustomDataProvider, FetchError, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { page } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import type { TrackedEntityAttributeField } from '../../types'
import { ProfileWidgetChangelogDialog } from '../ChangelogDialog'
import { nextChangelogOrder } from '../ChangelogTable'

/*
 * The dialog runs against app-runtime's CustomDataProvider, so the real
 * engine client, query, formatter and table are exercised without mocking
 * any module. app-runtime's Provider reports the server version under test,
 * which gates the data-item filter and the user / data-item sort.
 */

const field = (
    id: string,
    label: string,
    origin: TrackedEntityAttributeField['origin']
): TrackedEntityAttributeField => ({
    id,
    label,
    origin,
    valueType: 'TEXT',
    rawValue: null,
    value: { kind: 'empty' },
    displayInList: true,
    unique: false,
})

const attributes = [
    field('AttrFirst01', 'First name', 'both'),
    field('AttrLast001', 'Last name', 'program'),
    field('AttrNation1', 'Nationality', 'trackedEntityType'),
]

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']
type CustomResourceFactory = Extract<
    CustomData[string],
    (...args: never[]) => object
>
type ChangelogResponse = Awaited<ReturnType<CustomResourceFactory>>

const createdBy = {
    uid: 'User0000001',
    username: 'admin',
    firstName: 'John',
    surname: 'Traore',
}

const firstPage: ChangelogResponse = {
    pager: {
        page: 1,
        pageSize: 10,
        nextPage:
            'http://dhis2/api/tracker/trackedEntities/TrackedEnt1/changeLogs?page=2',
    },
    changeLogs: [
        {
            createdBy,
            createdAt: '2026-10-23T15:52:02.386',
            type: 'UPDATE',
            change: {
                attributeValue: {
                    attribute: 'AttrFirst01',
                    previousValue: 'Ada',
                    currentValue: 'Grace',
                },
            },
        },
        {
            createdBy: { username: 'system' },
            createdAt: '2026-10-22T08:05:00.000',
            type: 'CREATE',
            change: {
                attributeValue: {
                    attribute: 'AttrGone001',
                    currentValue: 'Kept',
                },
            },
        },
        {
            createdBy,
            createdAt: '2026-10-21T10:00:00.000',
            type: 'DELETE',
            change: {
                attributeValue: {
                    attribute: 'AttrLast001',
                    previousValue: 'Lovelace',
                },
            },
        },
    ],
}

const secondPage: ChangelogResponse = {
    pager: { page: 2, pageSize: 10, prevPage: 'http://dhis2/api/x?page=1' },
    changeLogs: [
        {
            createdBy,
            createdAt: '2026-10-20T10:00:00.000',
            type: 'CREATE',
            change: {
                attributeValue: {
                    attribute: 'AttrFirst01',
                    currentValue: 'Ada',
                },
            },
        },
    ],
}

const setup = ({
    minorVersion,
    respond,
    programId = 'Program0001',
    dialogAttributes = attributes,
    extraData = {},
}: {
    /** The DHIS2 minor version the Provider reports */
    minorVersion: number
    respond: (params: URLSearchParams) => Promise<ChangelogResponse>
    programId?: string
    dialogAttributes?: readonly TrackedEntityAttributeField[]
    extraData?: CustomData
}) => {
    const requests: URLSearchParams[] = []
    // The block's own retry policy still applies (operational failures are
    // retried twice); a zero delay keeps those retries instant.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })
    const data: CustomData = {
        ...extraData,
        'system/info': { calendar: 'iso8601', dateFormat: 'yyyy-mm-dd' },
        'tracker/trackedEntities/TrackedEnt1/changeLogs': async (
            _type,
            query
        ) => {
            const params = new URLSearchParams()
            Object.entries(query.params ?? {}).forEach(([key, value]) => {
                if (value !== undefined) params.set(key, String(value))
            })
            requests.push(params)
            return respond(params)
        },
    }

    const view = render(
        <Provider
            config={{
                baseUrl: 'https://dhis2.test',
                apiVersion: minorVersion,
                serverVersion: {
                    full: `2.${minorVersion}.0`,
                    major: 2,
                    minor: minorVersion,
                },
            }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>
                <QueryClientProvider client={queryClient}>
                    <ProfileWidgetChangelogDialog
                        open
                        onOpenChange={() => undefined}
                        trackedEntityId="TrackedEnt1"
                        programId={programId}
                        attributes={dialogAttributes}
                    />
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    return { requests, view }
}

const byDataTest = (id: string) => `[data-test="${id}"]`

const rows = () =>
    Array.from(
        document.querySelectorAll<HTMLTableRowElement>(
            byDataTest('profile-widget-changelog-row')
        )
    )

const cellTexts = () =>
    rows().map((row) =>
        Array.from(row.cells).map((cell) => cell.textContent?.trim())
    )

const pagedResponder = async (params: URLSearchParams) =>
    params.get('page') === '2' ? secondPage : firstPage

describe('ProfileWidgetChangelogDialog', () => {
    it('renders every row with its user, data item, change tag and values', async () => {
        const { requests } = setup({
            minorVersion: 43,
            respond: pagedResponder,
        })

        await expect
            .element(page.getByRole('dialog', { name: 'Changelog' }))
            .toBeVisible()
        await expect.poll(() => rows().length).toBe(3)

        expect(cellTexts()).toEqual([
            [
                '2026-10-23 15:52',
                'John Traore (admin)',
                'First name',
                'Updated',
                'Previous value: AdaNew value: Grace',
            ],
            [
                '2026-10-22 08:05',
                'system',
                'AttrGone001',
                'Created',
                'New value: Kept',
            ],
            [
                '2026-10-21 10:00',
                'John Traore (admin)',
                'Last name',
                'Deleted',
                'Previous value: Lovelace',
            ],
        ])
        expect(
            rows().map((row) =>
                row
                    .querySelector('[data-change-type]')
                    ?.getAttribute('data-change-type')
            )
        ).toEqual(['UPDATE', 'CREATE', 'DELETE'])
        expect(Object.fromEntries(requests[0] ?? [])).toEqual({
            page: '1',
            pageSize: '10',
            program: 'Program0001',
        })
    })

    it('pages with previous and next', async () => {
        const { requests } = setup({
            minorVersion: 43,
            respond: pagedResponder,
        })
        const previous = page.getByRole('button', { name: 'Previous page' })
        const next = page.getByRole('button', { name: 'Next page' })

        await expect.element(next).toBeEnabled()
        await expect.element(previous).toBeDisabled()

        await next.click()
        await expect
            .element(page.getByRole('cell', { name: '2026-10-20 10:00' }))
            .toBeVisible()
        expect(rows()).toHaveLength(1)
        expect(requests.at(-1)?.get('page')).toBe('2')
        await expect.element(next).toBeDisabled()
        await expect.element(previous).toBeEnabled()

        await previous.click()
        await expect
            .element(page.getByRole('cell', { name: '2026-10-23 15:52' }))
            .toBeVisible()
    })

    it('keeps the current page on screen while the next page looks up names', async () => {
        let releaseOrgUnits = () => {}
        const orgUnitsReleased = new Promise<void>((resolve) => {
            releaseOrgUnits = resolve
        })
        const orgUnitPage: ChangelogResponse = {
            pager: { page: 2, pageSize: 10, prevPage: 'http://dhis2/x?page=1' },
            changeLogs: [
                {
                    createdBy,
                    createdAt: '2026-10-19T09:00:00.000',
                    type: 'CREATE',
                    change: {
                        attributeValue: {
                            attribute: 'AttrPlace01',
                            currentValue: 'DiszpKrYNg8',
                        },
                    },
                },
            ],
        }
        setup({
            minorVersion: 43,
            respond: async (params) =>
                params.get('page') === '2' ? orgUnitPage : firstPage,
            dialogAttributes: [
                ...attributes,
                {
                    ...field('AttrPlace01', 'Home facility', 'program'),
                    valueType: 'ORGANISATION_UNIT',
                },
            ],
            extraData: {
                organisationUnits: async () => {
                    await orgUnitsReleased
                    return {
                        organisationUnits: [
                            {
                                id: 'DiszpKrYNg8',
                                displayName: 'Ngelehun CHC',
                                ancestors: [{ displayName: 'Sierra Leone' }],
                            },
                        ],
                    }
                },
            },
        })

        await page.getByRole('button', { name: 'Next page' }).click()
        await expect
            .poll(() =>
                document.querySelector(
                    `${byDataTest('profile-widget-changelog-pagination')} [aria-label="Loading changelog"]`
                )
            )
            .not.toBeNull()
        // The org-unit lookup is still pending: page 1 stays, no loading row.
        expect(rows()).toHaveLength(3)
        await expect
            .element(page.getByRole('cell', { name: '2026-10-23 15:52' }))
            .toBeVisible()

        releaseOrgUnits()
        await expect.poll(() => rows().length).toBe(1)
        expect(rows()[0]?.textContent).toContain('Ngelehun CHC')
    })

    it('filters by data item and sorts by user and data item on 2.42+', async () => {
        const { requests } = setup({
            minorVersion: 43,
            respond: pagedResponder,
        })
        await expect
            .element(page.getByRole('button', { name: 'Next page' }))
            .toBeEnabled()
        await page.getByRole('button', { name: 'Next page' }).click()
        await expect
            .element(page.getByRole('cell', { name: '2026-10-20 10:00' }))
            .toBeVisible()

        await page.getByRole('combobox', { name: 'Data item' }).click()
        // With a program, only attributes the program call can return are listed.
        await expect
            .element(page.getByRole('option', { name: 'Nationality' }))
            .not.toBeInTheDocument()
        await page.getByRole('option', { name: 'Last name' }).click()

        await expect
            .poll(() => requests.at(-1)?.get('filter'))
            .toBe('attribute:eq:AttrLast001')
        expect(requests.at(-1)?.get('page')).toBe('1')

        await page.getByRole('button', { name: 'User' }).click()
        await expect
            .poll(() => requests.at(-1)?.get('order'))
            .toBe('username:asc')
        await page.getByRole('button', { name: 'User' }).click()
        await expect
            .poll(() => requests.at(-1)?.get('order'))
            .toBe('username:desc')
        await expect
            .element(page.getByRole('columnheader', { name: 'User' }))
            .toHaveAttribute('aria-sort', 'descending')

        await page.getByRole('button', { name: 'Data item' }).click()
        await expect
            .poll(() => requests.at(-1)?.get('order'))
            .toBe('attribute:asc')
    })

    it('lists tracked entity type attributes in the filter without a program', async () => {
        setup({ minorVersion: 43, respond: pagedResponder, programId: '' })

        await page.getByRole('combobox', { name: 'Data item' }).click()
        await expect
            .element(page.getByRole('option', { name: 'Nationality' }))
            .toBeVisible()
        await expect
            .element(page.getByRole('option', { name: 'Last name' }))
            .not.toBeInTheDocument()
    })

    it('offers only date sorting and no filter on 2.41', async () => {
        const { requests } = setup({
            minorVersion: 41,
            respond: pagedResponder,
        })
        await expect
            .element(page.getByRole('cell', { name: '2026-10-23 15:52' }))
            .toBeVisible()

        await expect
            .element(page.getByRole('combobox', { name: 'Data item' }))
            .not.toBeInTheDocument()
        await expect
            .element(page.getByRole('button', { name: 'User' }))
            .not.toBeInTheDocument()

        await page.getByRole('button', { name: 'Date' }).click()
        await expect
            .poll(() => requests.at(-1)?.get('order'))
            .toBe('createdAt:asc')
        expect(requests.at(-1)?.has('filter')).toBe(false)
    })

    it('shows the empty state', async () => {
        setup({
            minorVersion: 43,
            respond: async () => ({
                pager: { page: 1, pageSize: 10 },
                changeLogs: [],
            }),
        })

        await expect
            .element(page.getByText('No changes to display'))
            .toBeVisible()
        await expect
            .element(page.getByRole('button', { name: 'Next page' }))
            .toBeDisabled()
    })

    it('shows the error state when the changelog cannot be loaded', async () => {
        setup({
            minorVersion: 43,
            respond: async () => {
                throw new FetchError({
                    type: 'access',
                    message: 'Forbidden',
                    details: { httpStatusCode: 403, message: 'Forbidden' },
                })
            },
        })

        await expect
            .element(page.getByText('The changelog could not be loaded'))
            .toBeVisible()
        expect(
            document.querySelector(byDataTest('profile-widget-changelog-table'))
        ).toBeNull()
    })

    it('keeps earlier pages reachable after a page fails, and retries it', async () => {
        let failSecondPage = true
        const { requests } = setup({
            minorVersion: 43,
            respond: async (params) => {
                if (params.get('page') !== '2') return firstPage
                if (failSecondPage) {
                    throw new FetchError({
                        type: 'unknown',
                        message: 'Bad gateway',
                        details: { httpStatusCode: 502 },
                    })
                }
                return secondPage
            },
        })
        const previous = page.getByRole('button', { name: 'Previous page' })
        const next = page.getByRole('button', { name: 'Next page' })

        await next.click()
        await expect
            .element(page.getByText('The changelog could not be loaded'))
            .toBeVisible()
        await expect.element(previous).toBeEnabled()
        await expect.element(next).toBeDisabled()

        // Back to the cached first page.
        await previous.click()
        await expect
            .element(page.getByRole('cell', { name: '2026-10-23 15:52' }))
            .toBeVisible()
        expect(
            document.querySelector(byDataTest('profile-widget-changelog-error'))
        ).toBeNull()

        // Forward again, then retry once the server recovers.
        await next.click()
        const retry = page.getByRole('button', { name: 'Try again' })
        await expect.element(retry).toBeEnabled()
        failSecondPage = false
        await retry.click()
        await expect
            .element(page.getByRole('cell', { name: '2026-10-20 10:00' }))
            .toBeVisible()
        expect(requests.at(-1)?.get('page')).toBe('2')
        await expect.element(previous).toBeEnabled()
    })

    it('offers "Show all" first in the data-item filter, like Capture', async () => {
        setup({ minorVersion: 43, respond: pagedResponder })

        const filter = page.getByRole('combobox', { name: 'Data item' })
        await expect.element(filter).toHaveTextContent('Show all')
        await filter.click()
        await expect
            .element(page.getByRole('option').first())
            .toHaveTextContent('Show all')
    })

    it('shows a spinner while the first page loads', async () => {
        setup({
            minorVersion: 43,
            respond: () => new Promise<ChangelogResponse>(() => undefined),
        })

        await expect
            .element(page.getByRole('status', { name: 'Loading changelog' }))
            .toBeVisible()
    })
})

describe('nextChangelogOrder', () => {
    it('cycles ascending, descending, unsorted', () => {
        const ascending = nextChangelogOrder(null, 'username')
        expect(ascending).toEqual({ column: 'username', direction: 'asc' })
        const descending = nextChangelogOrder(ascending, 'username')
        expect(descending).toEqual({ column: 'username', direction: 'desc' })
        expect(nextChangelogOrder(descending, 'username')).toBeNull()
    })

    it('starts a new column ascending', () => {
        expect(
            nextChangelogOrder(
                { column: 'username', direction: 'desc' },
                'createdAt'
            )
        ).toEqual({ column: 'createdAt', direction: 'asc' })
    })
})
