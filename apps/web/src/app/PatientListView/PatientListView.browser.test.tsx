import { CustomDataProvider, Provider, useDataEngine } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { useMemo, type ComponentProps } from 'react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { vi } from 'vitest'
import { page, userEvent } from 'vitest/browser'
import { render } from 'vitest-browser-react'
import { createAppClient } from '../AppShell/appClient'
import { parseAppPageSize } from '../urlState'
import { useAppUrlState } from '../useAppUrlState'
import { PatientListView } from './PatientListView'

type EngineValue = Awaited<
    ReturnType<ReturnType<typeof useDataEngine>['mutate']>
>
type CustomResourceFactory = Exclude<
    ComponentProps<typeof CustomDataProvider>['data'][string],
    EngineValue
>
type RequestParams = NonNullable<Parameters<CustomResourceFactory>[1]['params']>

const PROGRAM = 'tstProgram1'
const ORG_UNIT = 'tstOrgUnit1'
const FIRST_NAME = 'firstName01'
const GENDER = 'gender00001'
const WEIGHT = 'weight00001'
const DAY = 24 * 60 * 60 * 1000
const givenNames = ['Amina', 'Bakary', 'Chidi', 'Dalia', 'Esi', 'Fatou']

const programMetadata: EngineValue = {
    id: PROGRAM,
    programTrackedEntityAttributes: [
        {
            displayInList: false,
            searchable: true,
            sortOrder: 3,
            trackedEntityAttribute: {
                id: WEIGHT,
                displayName: 'Weight',
                valueType: 'NUMBER',
            },
        },
        {
            displayInList: true,
            searchable: true,
            sortOrder: 1,
            trackedEntityAttribute: {
                id: FIRST_NAME,
                displayName: 'First name (long)',
                displayFormName: 'First name',
                valueType: 'TEXT',
            },
        },
        {
            displayInList: true,
            searchable: false,
            sortOrder: 2,
            trackedEntityAttribute: {
                id: GENDER,
                displayName: 'Gender',
                valueType: 'TEXT',
                optionSet: {
                    options: [
                        { code: 'F', displayName: 'Female' },
                        { code: 'M', displayName: 'Male' },
                    ],
                },
            },
        },
    ],
}

// A type, not an interface, so it fits the engine's JSON value type.
type FakeTrackedEntity = {
    trackedEntity: string
    createdAt: string
    attributes: { attribute: string; value: string }[]
    enrollments: {
        enrollment: string
        program: string
        status: string
        enrolledAt: string
        occurredAt: string
        orgUnit: string
    }[]
}

/** Each tracked entity is created a day before the one before it. */
const trackedEntities: FakeTrackedEntity[] = Array.from(
    { length: 40 },
    (_, index) => {
        const id = String(index + 1).padStart(2, '0')
        const created = new Date(Date.UTC(2024, 5, 30) - index * DAY)
            .toISOString()
            .slice(0, 23)
        return {
            trackedEntity: `te${id}`,
            createdAt: created,
            attributes: [
                {
                    attribute: FIRST_NAME,
                    value: `${givenNames[index % givenNames.length]} ${id}`,
                },
                { attribute: GENDER, value: index % 2 === 0 ? 'F' : 'M' },
                { attribute: WEIGHT, value: String(50 + index) },
            ],
            enrollments: [
                {
                    enrollment: `en${id}`,
                    program: PROGRAM,
                    status: 'ACTIVE',
                    enrolledAt: created,
                    occurredAt: created,
                    orgUnit: ORG_UNIT,
                },
            ],
        }
    }
)

const valueOf = (entity: FakeTrackedEntity, field: string) =>
    field === 'createdAt'
        ? entity.createdAt
        : (entity.attributes.find(({ attribute }) => attribute === field)
              ?.value ?? '')

/** One page of `tracker/trackedEntities` (2.42 format) in `order`. */
const answerTrackedEntities = (params: RequestParams): EngineValue => {
    const page = Number(params.page ?? 1)
    const pageSize = Number(params.pageSize ?? 50)
    const [field = 'createdAt', direction] = String(
        params.order ?? 'createdAt:desc'
    ).split(':')
    const found = trackedEntities.toSorted((a, b) => {
        const compared = valueOf(a, field).localeCompare(valueOf(b, field))
        return direction === 'desc' ? -compared : compared
    })
    const start = (page - 1) * pageSize
    const hasNext = start + pageSize < found.length
    return {
        trackedEntities: found.slice(start, start + pageSize),
        pager: {
            page,
            pageSize,
            ...(hasNext && {
                nextPage: `https://dhis2.test/api/tracker/trackedEntities?page=${page + 1}`,
            }),
        },
    }
}

interface FakeServer {
    data: ComponentProps<typeof CustomDataProvider>['data']
    /** The params of every `tracker/trackedEntities` request, in order. */
    requests: RequestParams[]
    /** While set, the program metadata request fails with this message. */
    metadataFailure: string | undefined
    /** While true, the program metadata waits for `release()`. */
    metadataHeld: boolean
    release: () => void
}

const createFakeServer = (): FakeServer => {
    let waiting: (() => void)[] = []
    const server: FakeServer = {
        data: {},
        requests: [],
        metadataFailure: undefined,
        metadataHeld: false,
        release: () => {
            const released = waiting
            waiting = []
            for (const resolve of released) resolve()
        },
    }
    const programs: CustomResourceFactory = async (_type, request) => {
        if (server.metadataHeld) {
            await new Promise<void>((resolve) => waiting.push(resolve))
        }
        const message = server.metadataFailure
        if (message !== undefined) {
            throw Object.assign(new Error(message), {
                details: { httpStatusCode: 409, message },
            })
        }
        if (request.id !== PROGRAM) {
            throw new Error(`The fake has no program ${request.id}`)
        }
        return programMetadata
    }
    const trackedEntitiesResource: CustomResourceFactory = async (
        _type,
        request
    ) => {
        const params = request.params ?? {}
        server.requests.push(params)
        return answerTrackedEntities(params)
    }
    server.data = {
        programs,
        'tracker/trackedEntities': trackedEntitiesResource,
    }
    return server
}

const RoutedPatientList = ({
    onPaginationChange,
    onRowOpen,
}: {
    onPaginationChange: (next: { page: number; pageSize: number }) => void
    onRowOpen: (trackedEntityId: string) => void
}) => {
    const engine = useDataEngine()
    const client = useMemo(() => createAppClient(engine), [engine])
    const [urlState, setUrlState] = useAppUrlState()
    if (!urlState.programId || !urlState.orgUnitId) return null
    return (
        <main>
            <PatientListView
                client={client}
                programId={urlState.programId}
                orgUnitId={urlState.orgUnitId}
                page={urlState.page ?? 1}
                pageSize={urlState.pageSize ?? 15}
                onPaginationChange={(next) => {
                    onPaginationChange(next)
                    // As the app shell does.
                    setUrlState((current) => ({
                        ...current,
                        page: next.page,
                        pageSize: parseAppPageSize(next.pageSize),
                    }))
                }}
                onRowOpen={onRowOpen}
            />
        </main>
    )
}

const urlFor = (pageNumber: number) =>
    `/?programId=${PROGRAM}&orgUnitId=${ORG_UNIT}&page=${pageNumber}&pageSize=15`

/** The list at `url` in a memory router, the fake server and its own query client. */
const renderList = async (server: FakeServer, url = urlFor(1)) => {
    const onPaginationChange = vi.fn()
    const onRowOpen = vi.fn()
    const router = createMemoryRouter(
        [
            {
                path: '/',
                element: (
                    <RoutedPatientList
                        onPaginationChange={onPaginationChange}
                        onRowOpen={onRowOpen}
                    />
                ),
            },
        ],
        { initialEntries: [url] }
    )
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })
    await render(
        <Provider
            config={{ baseUrl: 'https://dhis2.test', apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={server.data}>
                <QueryClientProvider client={queryClient}>
                    <RouterProvider router={router} />
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
    return { router, onPaginationChange, onRowOpen }
}

/** The first names on the page, after each row's "Open row" button. */
const shownFirstNames = () =>
    [...document.querySelectorAll(`td[data-column-id="${FIRST_NAME}"]`)].map(
        (cell) => cell.lastChild?.textContent
    )
const pageInfo = () =>
    page.getByRole('navigation', { name: 'Pagination' }).getByText(/^Page \d+$/)
const pagesRequested = (server: FakeServer) =>
    server.requests.map((params) => Number(params.page))
const urlPage = (router: ReturnType<typeof createMemoryRouter>) =>
    new URLSearchParams(router.state.location.search).get('page')

describe('PatientListView', () => {
    it('shows a spinner while the program attributes load', async () => {
        const server = createFakeServer()
        server.metadataHeld = true
        await renderList(server)

        await expect
            .element(page.getByTestId('patient-list-loading'))
            .toBeVisible()
        expect(server.requests).toEqual([])

        server.release()
        await expect
            .element(page.getByRole('table', { name: 'Patient list' }))
            .toBeVisible()
        await expect
            .element(page.getByTestId('patient-list-loading'))
            .not.toBeInTheDocument()
    })

    it('explains a failed metadata request, and Try again recovers', async () => {
        const server = createFakeServer()
        server.metadataFailure = 'You have no access to this program'
        await renderList(server)

        const error = page.getByTestId('patient-list-error')
        await expect
            .element(error.getByText('The list columns could not be loaded'))
            .toBeVisible()
        await expect
            .element(error.getByText('You have no access to this program'))
            .toBeVisible()

        server.metadataFailure = undefined
        await error.getByRole('button', { name: 'Try again' }).click()
        await expect.poll(shownFirstNames).toContain('Amina 01')
    })

    it('builds the columns from the program attributes', async () => {
        const server = createFakeServer()
        await renderList(server)
        await expect.poll(shownFirstNames).toContain('Amina 01')

        const columnIds = [
            ...document.querySelectorAll('th[data-column-id]'),
        ].map((head) => head.getAttribute('data-column-id'))
        expect(columnIds).toEqual(
            expect.arrayContaining([
                FIRST_NAME,
                GENDER,
                'enrolledAt',
                'enrollmentStatus',
            ])
        )
        expect(columnIds).not.toContain(WEIGHT)
        expect(columnIds.indexOf(FIRST_NAME)).toBeLessThan(
            columnIds.indexOf(GENDER)
        )
        await expect
            .element(
                page.getByRole('button', { name: 'First name', exact: true })
            )
            .toBeVisible()

        const firstRow = page.getByRole('row').nth(1)
        await expect.element(firstRow.getByText('Female')).toBeVisible()
        await expect.element(firstRow.getByText('Jun 30, 2024')).toBeVisible()
        await expect.element(firstRow.getByText('Active')).toBeVisible()
    })

    it('opens a row with its tracked entity id', async () => {
        const server = createFakeServer()
        const { onRowOpen } = await renderList(server)
        const open = page.getByRole('button', { name: 'Open row 2' })
        await expect.element(open).toBeInTheDocument()

        open.element().focus()
        await userEvent.keyboard('{Enter}')
        expect(onRowOpen).toHaveBeenCalledExactlyOnceWith('te02')
    })

    it('asks for the page of a deep link first, and never for page 1', async () => {
        const server = createFakeServer()
        const { onPaginationChange } = await renderList(server, urlFor(2))

        await expect.element(pageInfo()).toHaveTextContent('Page 2')
        await expect.poll(shownFirstNames).toContain('Amina 19')
        expect(pagesRequested(server)).toEqual([2])
        expect(server.requests[0]).toMatchObject({
            program: PROGRAM,
            orgUnits: ORG_UNIT,
            pageSize: 15,
        })
        expect(onPaginationChange).not.toHaveBeenCalled()
    })

    it('writes the next page to the URL', async () => {
        const server = createFakeServer()
        const { router, onPaginationChange } = await renderList(server)
        await expect.poll(shownFirstNames).toContain('Amina 01')

        await userEvent.click(page.getByRole('button', { name: 'Next' }))

        await expect.element(pageInfo()).toHaveTextContent('Page 2')
        expect(onPaginationChange).toHaveBeenCalledExactlyOnceWith({
            page: 2,
            pageSize: 15,
        })
        await expect.poll(() => urlPage(router)).toBe('2')
        expect(pagesRequested(server)).toEqual([1, 2])
    })

    it('sorts from page 1 without asking for page 2 in the new order', async () => {
        const server = createFakeServer()
        const { router, onPaginationChange } = await renderList(
            server,
            urlFor(2)
        )
        await expect.poll(shownFirstNames).toContain('Amina 19')

        await userEvent.click(
            page.getByRole('button', { name: 'First name', exact: true })
        )

        const order = `${FIRST_NAME}:asc`
        await expect.element(pageInfo()).toHaveTextContent('Page 1')
        await expect
            .poll(() => shownFirstNames().slice(0, 2))
            .toEqual(['Amina 01', 'Amina 07'])
        const sorted = server.requests.filter(
            (params) => params.order === order
        )
        expect(sorted.map((params) => Number(params.page))).toEqual([1])
        expect(onPaginationChange).toHaveBeenCalledExactlyOnceWith({
            page: 1,
            pageSize: 15,
        })
        await expect.poll(() => urlPage(router)).toBe('1')
        expect(
            server.requests.some(
                (params) => params.order === order && Number(params.page) === 2
            )
        ).toBe(false)
    })

    it('asks for the page the URL moves to from outside', async () => {
        const server = createFakeServer()
        const { router, onPaginationChange } = await renderList(
            server,
            urlFor(2)
        )
        await expect.poll(shownFirstNames).toContain('Amina 19')

        await router.navigate(urlFor(3))

        await expect.element(pageInfo()).toHaveTextContent('Page 3')
        await expect.poll(shownFirstNames).toContain('Amina 31')
        expect(pagesRequested(server)).toEqual([2, 3])
        expect(onPaginationChange).not.toHaveBeenCalled()
    })
})
