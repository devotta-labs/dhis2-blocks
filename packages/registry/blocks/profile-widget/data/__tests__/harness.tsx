import { CustomDataProvider, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import {
    programJson,
    recordJson,
    SYSTEM_INFO_JSON,
    trackedEntityTypeJson,
} from './fixtures'

/*
 * The hooks run against app-runtime's real Provider (so `useConfig()` reports
 * a 2.43 server at https://dhis2.test) and a CustomDataProvider that routes
 * every request by resource. No module is mocked.
 */

type CustomData = React.ComponentProps<typeof CustomDataProvider>['data']
type CustomResourceFactory = Extract<
    CustomData[string],
    (...args: never[]) => object
>
type ResolvedQuery = Parameters<CustomResourceFactory>[1]
type Json = Exclude<Awaited<ReturnType<CustomResourceFactory>>, undefined>

type Fixture =
    | ReturnType<typeof programJson>
    | ReturnType<typeof trackedEntityTypeJson>
    | ReturnType<typeof recordJson>

/** Fixture objects carry `undefined` for omitted fields; JSON drops them like the server. */
export const toJson = (fixture: Fixture): Json =>
    JSON.parse(JSON.stringify(fixture))

interface LoggedRequest {
    resource: string
    id?: string
    params: Partial<Record<string, string>>
}

export type Responder = (request: LoggedRequest) => Promise<Json> | Json

interface Deferred {
    promise: Promise<void>
    resolve: () => void
}

export const createDeferred = (): Deferred => {
    let resolve = () => {}
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

/** Default answers for a Person in the Child Programme on 2.43. */
const defaultResponders = (): Map<string, Responder> =>
    new Map<string, Responder>([
        ['programs', () => toJson(programJson({ enableChangeLog: true }))],
        [
            'trackedEntityTypes',
            () => toJson(trackedEntityTypeJson({ enableChangeLog: true })),
        ],
        ['tracker/trackedEntities', () => toJson(recordJson())],
        ['me', () => ({ authorities: ['F_TEI_CASCADE_DELETE'] })],
        ['system/info', () => SYSTEM_INFO_JSON],
        [
            'fileResources',
            ({ id }) => ({ id: id ?? '', displayName: 'consent.pdf' }),
        ],
        [
            'organisationUnits',
            () => ({
                organisationUnits: [
                    {
                        id: 'DiszpKrYNg8',
                        displayName: 'Ngelehun CHC',
                        ancestors: [
                            { displayName: 'Sierra Leone' },
                            { displayName: 'Bo' },
                            { displayName: 'Badjia' },
                        ],
                    },
                ],
            }),
        ],
    ])

const toLoggedRequest = (query: ResolvedQuery): LoggedRequest => ({
    resource: query.resource,
    id: query.id,
    params: Object.fromEntries(
        Object.entries(query.params ?? {}).flatMap(([key, value]) =>
            value === undefined ? [] : [[key, String(value)]]
        )
    ),
})

/**
 * A wrapper plus the request log. `responders` replaces default answers by
 * resource; every request is logged before its responder runs.
 */
export const createHarness = (
    overrides: Map<string, Responder> = new Map()
) => {
    const responders = new Map([...defaultResponders(), ...overrides])
    const requests: LoggedRequest[] = []
    const toFactory =
        (respond: Responder): CustomResourceFactory =>
        async (_type, query) => {
            const request = toLoggedRequest(query)
            requests.push(request)
            return respond(request)
        }
    const data: CustomData = Object.fromEntries(
        [...responders].map(([resource, respond]) => [
            resource,
            toFactory(respond),
        ])
    )
    // The block's own retry policy still applies (it retries operational
    // failures twice); a zero delay keeps those retries instant in tests.
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })

    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <Provider
            config={{
                baseUrl: 'https://dhis2.test',
                apiVersion: 43,
                serverVersion: { full: '2.43.1', major: 2, minor: 43 },
            }}
            userInfo={undefined}
            plugin={false}
            parentAlertsAdd={undefined}
            showAlertsInPlugin={false}
        >
            <CustomDataProvider data={data}>
                <QueryClientProvider client={queryClient}>
                    {children}
                </QueryClientProvider>
            </CustomDataProvider>
        </Provider>
    )

    const resourcesRequested = () => requests.map((request) => request.resource)

    return { wrapper, requests, resourcesRequested }
}
