import {
    CustomDataProvider,
    Provider,
    type useDataEngine,
} from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState, type ComponentProps, type ReactNode } from 'react'
import {
    attributeColumn,
    attributeTextFilter,
    enrollmentStatusFilter,
    fieldColumn,
} from '..'

type EngineValue = Awaited<
    ReturnType<ReturnType<typeof useDataEngine>['mutate']>
>
type CustomResourceFactory = Exclude<
    ComponentProps<typeof CustomDataProvider>['data'][string],
    EngineValue
>
type ResourceRequest = Parameters<CustomResourceFactory>[1]
export type RequestParams = NonNullable<ResourceRequest['params']>

export const PROGRAM = 'tstProgram1'
export const OTHER_PROGRAM = 'tstProgram2'
export const ORG_UNIT = 'tstOrgUnit1'
export const OTHER_ORG_UNIT = 'tstOrgUnit2'
export const FIRST_NAME = 'tstFirstNam'
export const LAST_NAME = 'tstLastName'

const firstNames = [
    'Amina',
    'Bakary',
    'Chidi',
    'Dalia',
    'Esi',
    'Fatou',
    'Gabriel',
    'Hawa',
    'Ibrahim',
    'Jamila',
    'Kofi',
]
const lastNames = ['Bangura', 'Conteh', 'Kamara', 'Sesay', 'Turay', 'Koroma']
const statuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const
const DAY = 24 * 60 * 60 * 1000

// A type, not an interface, so it fits the engine's JSON value type.
type FakeTrackedEntity = {
    trackedEntity: string
    orgUnit: string
    createdAt: string
    updatedAt: string
    inactive: boolean
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

/**
 * Tracked entity `n` (from 1) is always the same; each is created a day
 * before the one before it, so the default `createdAt:desc` keeps them in
 * order.
 */
export const makeTrackedEntities = (count: number): FakeTrackedEntity[] =>
    Array.from({ length: count }, (_, index) => {
        const id = String(index + 1).padStart(2, '0')
        const created = new Date(Date.UTC(2024, 5, 30) - index * DAY)
            .toISOString()
            .slice(0, 23)
        return {
            trackedEntity: `te${id}`,
            orgUnit: ORG_UNIT,
            createdAt: created,
            updatedAt: created,
            inactive: false,
            attributes: [
                {
                    attribute: FIRST_NAME,
                    value: `${firstNames[index % firstNames.length]} ${id}`,
                },
                {
                    attribute: LAST_NAME,
                    value: lastNames[index % lastNames.length],
                },
            ],
            enrollments: [
                {
                    enrollment: `en${id}`,
                    program: PROGRAM,
                    status: statuses[index % statuses.length],
                    enrolledAt: created,
                    occurredAt: created,
                    orgUnit: ORG_UNIT,
                },
            ],
        }
    })

/** The value the fake orders and filters by, for a field or attribute uid. */
const valueOf = (entity: FakeTrackedEntity, field: string): string => {
    switch (field) {
        case 'createdAt':
        case 'updatedAt':
        case 'trackedEntity':
            return entity[field]
        case 'enrolledAt':
            return entity.enrollments[0]?.enrolledAt ?? ''
        default:
            return (
                entity.attributes.find(({ attribute }) => attribute === field)
                    ?.value ?? ''
            )
    }
}

const unescape = (value: string) => value.replace(/\/(.)/g, '$1')

/** `like`, `eq` and `sw` on one attribute, as `uid:operator:value`. */
const matches = (entity: FakeTrackedEntity, entry: string) => {
    const [attribute = '', operator = '', ...rest] = entry.split(':')
    const actual = valueOf(entity, attribute).toLowerCase()
    const expected = unescape(rest.join(':')).toLowerCase()
    switch (operator) {
        case 'like':
            return actual.includes(expected)
        case 'eq':
            return actual === expected
        case 'sw':
            return actual.startsWith(expected)
        default:
            throw new Error(`The fake does not filter with ${operator}`)
    }
}

const filterEntries = (params: RequestParams): string[] => {
    const filter = params.filter
    if (filter === undefined) return []
    return Array.isArray(filter) ? filter.map(String) : [String(filter)]
}

const ordered = (entities: FakeTrackedEntity[], order: string) => {
    const rules = order.split(',').map((rule) => rule.split(':'))
    return entities.toSorted((a, b) => {
        for (const [field = '', direction] of rules) {
            const compared = valueOf(a, field).localeCompare(valueOf(b, field))
            if (compared !== 0)
                return direction === 'desc' ? -compared : compared
        }
        return 0
    })
}

export interface FakeServer {
    data: ComponentProps<typeof CustomDataProvider>['data']
    /** The params of every request, in order. */
    requests: RequestParams[]
    /** While set, requests fail with this server message (HTTP 409). */
    failure: string | undefined
    /** While true, requests wait for `release()`. */
    held: boolean
    release: () => void
}

/**
 * A fake `tracker/trackedEntities` in the 2.42+ format: honours `page`,
 * `pageSize`, `order`, `filter` (`like`, `eq`, `sw`) and `enrollmentStatus`.
 */
export const createFakeServer = (count = 40): FakeServer => {
    const entities = makeTrackedEntities(count)
    let waiting: (() => void)[] = []

    const answer = (params: RequestParams): EngineValue => {
        const page = Number(params.page ?? 1)
        const pageSize = Number(params.pageSize ?? 50)
        const status = params.enrollmentStatus
        const found = ordered(
            entities.filter(
                (entity) =>
                    filterEntries(params).every((entry) =>
                        matches(entity, entry)
                    ) &&
                    (status === undefined ||
                        entity.enrollments[0]?.status === String(status))
            ),
            String(params.order ?? 'createdAt:desc')
        )
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

    const server: FakeServer = {
        data: {},
        requests: [],
        failure: undefined,
        held: false,
        release: () => {
            const released = waiting
            waiting = []
            for (const resolve of released) resolve()
        },
    }
    const respond: CustomResourceFactory = async (_type, request) => {
        const params = request.params ?? {}
        server.requests.push(params)
        if (server.held) {
            await new Promise<void>((resolve) => waiting.push(resolve))
        }
        const message = server.failure
        if (message !== undefined) {
            throw Object.assign(new Error(message), {
                details: { httpStatusCode: 409, message },
            })
        }
        return answer(params)
    }
    server.data = { 'tracker/trackedEntities': respond }
    return server
}

/**
 * App runtime on API 42 with the fake server, and a QueryClient of its own
 * that lasts across rerenders.
 */
export const PatientListProviders = ({
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

export const testColumns = [
    attributeColumn(FIRST_NAME, { header: 'First name' }),
    attributeColumn(LAST_NAME, {
        header: 'Last name',
        format: (value) => value?.toUpperCase(),
    }),
    fieldColumn('enrolledAt', {
        header: 'Enrolled',
        format: (value) => (value ? value.slice(0, 10) : ''),
    }),
    fieldColumn('enrollmentStatus', { header: 'Status' }),
]

export const testFilters = [
    attributeTextFilter({
        attribute: FIRST_NAME,
        label: 'First name',
        pinned: true,
    }),
    enrollmentStatusFilter({ pinned: true }),
]

/** Requests whose `filter` includes `entry`. */
export const requestsFiltering = (server: FakeServer, entry: string) =>
    server.requests.filter((params) => filterEntries(params).includes(entry))
