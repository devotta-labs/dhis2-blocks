import { Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ReactNode } from 'react'
import childPerson from '../api/__fixtures__/trackedEntity.child.json'
import noProgramPerson from '../api/__fixtures__/trackedEntity.noProgram.json'
import rmnchPerson from '../api/__fixtures__/trackedEntity.rmnch.json'
import childProgram from '../api/__fixtures__/program.child.json'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import personType from '../api/__fixtures__/trackedEntityType.person.json'
import {
    createTrackedEntityHeaderClient,
    type DataEngineLike,
    type ResourceRequest,
} from '../api/client'
import { useTrackedEntityHeader, type TrackedEntityHeaderState } from '../hooks'

export const RMNCH = 'WSGAb5XwJ3Y'
export const CHILD = 'IpHINAT79UW'

type Fixture = 'rmnch' | 'child'

interface FakeServerOptions {
    /** Answers person requests with a 403. */
    forbidden?: boolean
    /** Answers person requests with this status, until `recover` is called. */
    fail?: 400 | 404 | 500
    /** Holds the tracked entity request for this one, or this program, open until `release` is called. */
    deferFor?: string
    /** The person and program asked about when the request names neither of the other fixture's. */
    fixture?: Fixture
}

const PEOPLE = { rmnch: rmnchPerson, child: childPerson }
const PROGRAMS = { rmnch: rmnchProgram, child: childProgram }
const FIXTURE_OF_PROGRAM = new Map<string, Fixture>([
    [RMNCH, 'rmnch'],
    [CHILD, 'child'],
])

export const createFakeServer = (options: FakeServerOptions = {}) => {
    const requests: ResourceRequest[] = []
    let failing = options.fail
    let forbidden = options.forbidden
    let release = () => {}
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    const engine: DataEngineLike = {
        query: async (query) => {
            const [[key, request]] = Object.entries(query)
            requests.push(request)
            const program = request.params?.program
            // A person request names its program in the params, a program request in the id.
            const named = request.resource === 'programs' ? request.id : program
            const fixture =
                FIXTURE_OF_PROGRAM.get(String(named)) ??
                options.fixture ??
                'rmnch'
            switch (request.resource) {
                case 'tracker/trackedEntities': {
                    if (forbidden) {
                        throw Object.assign(new Error('Forbidden'), {
                            httpStatusCode: 403,
                        })
                    }
                    if (failing !== undefined) {
                        throw Object.assign(new Error('boom'), {
                            httpStatusCode: failing,
                        })
                    }
                    if (
                        options.deferFor !== undefined &&
                        [request.id, program].includes(options.deferFor)
                    ) {
                        await held
                    }
                    const person =
                        program === undefined
                            ? noProgramPerson
                            : PEOPLE[fixture]
                    return { [key]: { ...person, trackedEntity: request.id } }
                }
                case 'programs':
                    return { [key]: PROGRAMS[fixture] }
                default:
                    return { [key]: personType }
            }
        },
    }
    const countOf = (resource: string) =>
        requests.filter((request) => request.resource === resource).length
    return {
        client: createTrackedEntityHeaderClient(engine),
        requests,
        countOf,
        release,
        /** The server answers person requests again. */
        recover: () => {
            failing = undefined
        },
        /** From now on the server answers person requests with this status. */
        failWith: (status: 400 | 403 | 500) => {
            if (status === 403) {
                forbidden = true
            } else {
                failing = status
            }
        },
    }
}

/** A fresh QueryClient with retries off, and app-runtime's provider with a Gregorian system. */
export const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const systemInfo = {
        version: '2.42.0',
        contextPath: '',
        serverTimeZoneId: 'UTC',
        calendar: 'gregorian',
    }
    return ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>
            <Provider
                config={{ baseUrl: '..', apiVersion: 42, systemInfo }}
                userInfo={undefined}
                plugin={false}
                parentAlertsAdd={undefined}
                showAlertsInPlugin={false}
            >
                {children}
            </Provider>
        </QueryClientProvider>
    )
}

const describeState = (state: TrackedEntityHeaderState) =>
    state.status === 'ready'
        ? `ready ${state.trackedEntity.id} ${state.metadata.programName ?? state.metadata.typeName} ${state.trackedEntity.values.size}`
        : state.status

/** Shows the hook's state and records every state it rendered. */
export const Probe = ({ seen }: { seen?: string[] }) => {
    const state = useTrackedEntityHeader()
    const description = describeState(state)
    seen?.push(description)
    return (
        <>
            <output data-testid="state">{description}</output>
            <button type="button" onClick={state.retry}>
                Retry
            </button>
        </>
    )
}
