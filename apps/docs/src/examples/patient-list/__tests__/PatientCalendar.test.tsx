import {
    CustomDataProvider,
    Provider,
    type useDataEngine,
} from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ComponentProps, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import {
    CalendarDayRecords,
    CalendarGrid,
    CalendarNavigation,
} from '@/components/calendar'
import type {
    PatientListQuery,
    PatientListRow,
} from '@/components/patient-list'
import { PatientCalendar } from '../PatientCalendar'

type EngineValue = Awaited<
    ReturnType<ReturnType<typeof useDataEngine>['mutate']>
>
type CustomResourceFactory = Exclude<
    ComponentProps<typeof CustomDataProvider>['data'][string],
    EngineValue
>
type RequestParams = NonNullable<Parameters<CustomResourceFactory>[1]['params']>

// A type, not an interface, so it fits the engine's JSON value type.
type FakeTrackedEntity = {
    trackedEntity: string
    attributes: { attribute: string; value: string }[]
    enrollments: {
        enrollment: string
        program: string
        status: string
        enrolledAt: string
    }[]
}

const NAME = 'FirstName01'

const entity = (
    id: string,
    name: string,
    enrolledAt: string
): FakeTrackedEntity => ({
    trackedEntity: id,
    attributes: [{ attribute: NAME, value: name }],
    enrollments: [
        {
            enrollment: `${id}E`,
            program: 'Program0001',
            status: 'ACTIVE',
            enrolledAt,
        },
    ],
})

const ENTITIES = [
    entity('Entity00001', 'Amina', '2026-11-14T09:30:00.000'),
    entity('Entity00002', 'Bakary', '2026-11-20T00:00:00.000'),
]

const query: PatientListQuery = {
    program: 'Program0001',
    orgUnit: 'OrgUnit0001',
    page: 3,
    pageSize: 15,
    order: ['createdAt:desc'],
    filters: [`${NAME}:like:a`],
    enrollmentStatus: 'ACTIVE',
}

interface FakeServer {
    requests: RequestParams[]
    /** While set, requests fail with this server message (HTTP 409). */
    failure: string | undefined
    /** When true, every answer says there is a next page. */
    full: boolean
    data: ComponentProps<typeof CustomDataProvider>['data']
}

const createServer = (): FakeServer => {
    const server: FakeServer = {
        requests: [],
        failure: undefined,
        full: false,
        data: {},
    }
    const respond: CustomResourceFactory = async (_type, request) => {
        const params = request.params ?? {}
        server.requests.push(params)
        const message = server.failure
        if (message !== undefined) {
            throw Object.assign(new Error(message), {
                details: { httpStatusCode: 409, message },
            })
        }
        return {
            trackedEntities: ENTITIES,
            pager: {
                page: 1,
                pageSize: Number(params.pageSize),
                ...(server.full && { nextPage: 'https://dhis2.test/next' }),
            },
        }
    }
    server.data = { 'tracker/trackedEntities': respond }
    return server
}

const Providers = ({
    server,
    children,
}: {
    server: FakeServer
    children: ReactNode
}) => {
    const [queryClient] = useState(
        () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
    )
    return (
        <Provider
            config={{ baseUrl: 'https://dhis2.test', apiVersion: 42 }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={server.data}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )
}

const fullName = (row: PatientListRow) => row.attributes[NAME] ?? ''

const renderCalendar = (
    server: FakeServer,
    onRecordClick?: (row: PatientListRow) => void
) =>
    render(
        <Providers server={server}>
            <PatientCalendar
                query={query}
                limit={200}
                defaultSelectedDay="2026-11-14"
                recordLabel={fullName}
                onRecordClick={onRecordClick}
            >
                <CalendarNavigation />
                <CalendarGrid />
                <CalendarDayRecords />
            </PatientCalendar>
        </Providers>
    )

describe('PatientCalendar', () => {
    it('loads the visible weeks of the list and puts each record on its day', async () => {
        const server = createServer()
        const view = await renderCalendar(server)

        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toBeVisible()
        await expect
            .element(
                view.getByRole('button', { name: '20 November 2026, 1 record' })
            )
            .toBeVisible()
        expect(server.requests).toHaveLength(1)
        expect(server.requests[0]).toMatchObject({
            program: 'Program0001',
            orgUnits: 'OrgUnit0001',
            page: 1,
            pageSize: 200,
            order: 'enrolledAt:asc',
            filter: [`${NAME}:like:a`],
            enrollmentStatus: 'ACTIVE',
            enrollmentEnrolledAfter: '2026-10-26',
            enrollmentEnrolledBefore: '2026-12-06',
        })
    })

    it('asks for the new weeks when the month changes', async () => {
        const server = createServer()
        const view = await renderCalendar(server)
        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toBeVisible()

        await view.getByRole('button', { name: 'Next month' }).click()

        await expect.poll(() => server.requests).toHaveLength(2)
        expect(server.requests[1]).toMatchObject({
            enrollmentEnrolledAfter: '2026-11-30',
            enrollmentEnrolledBefore: '2027-01-03',
        })
    })

    it('says so when there are more records than it loaded', async () => {
        const server = createServer()
        server.full = true
        const view = await renderCalendar(server)

        await expect
            .element(view.getByText(/Showing the first 2 records/))
            .toBeVisible()
    })

    it('shows a failed request and tries again', async () => {
        const server = createServer()
        server.failure = 'Not allowed'
        const view = await renderCalendar(server)

        await expect
            .element(view.getByText('Records could not be loaded'))
            .toBeVisible()
        server.failure = undefined
        await view.getByRole('button', { name: 'Try again' }).click()

        await expect
            .element(
                view.getByRole('button', { name: '14 November 2026, 1 record' })
            )
            .toBeVisible()
        expect(server.requests).toHaveLength(2)
    })

    it('hands the row of a clicked record to onRecordClick', async () => {
        const server = createServer()
        const onRecordClick = vi.fn<(row: PatientListRow) => void>()
        const view = await renderCalendar(server, onRecordClick)

        await view.getByRole('button', { name: 'Amina', exact: true }).click()

        expect(onRecordClick).toHaveBeenCalledTimes(1)
        expect(onRecordClick.mock.calls[0]?.[0]).toMatchObject({
            trackedEntity: 'Entity00001',
            attributes: { [NAME]: 'Amina' },
        })
    })
})
