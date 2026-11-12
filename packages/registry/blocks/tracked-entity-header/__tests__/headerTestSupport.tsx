import { CustomDataProvider, FetchError, Provider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps, type ReactNode } from 'react'
import { z } from 'zod'
import childPerson from '../api/__fixtures__/trackedEntity.child.json'
import noProgramPerson from '../api/__fixtures__/trackedEntity.noProgram.json'
import rmnchPerson from '../api/__fixtures__/trackedEntity.rmnch.json'
import childProgram from '../api/__fixtures__/program.child.json'
import rmnchProgram from '../api/__fixtures__/program.rmnch.json'
import relationshipTypes from '../api/__fixtures__/relationshipTypes.malaria.json'
import caseLinks from '../api/__fixtures__/relationships.case.json'
import focusLinks from '../api/__fixtures__/relationships.focus.json'
import viewAttributes from '../api/__fixtures__/trackedEntityAttributes.malaria.json'
import personType from '../api/__fixtures__/trackedEntityType.person.json'
import { useTrackedEntityHeader, type TrackedEntityHeaderState } from '../hooks'

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

/** A request as the data engine hands it to the server. */
const RequestSchema = z.object({
    resource: z.string(),
    id: z.string().optional(),
    params: z.record(z.string(), z.json()).optional(),
})
export type HeaderRequest = z.infer<typeof RequestSchema>

const BodySchema = z.json()

type BodyValue =
    | string
    | number
    | boolean
    | null
    | undefined
    | BodyValue[]
    | ResponseBody

/** A response body as a test writes it: JSON, with a property left undefined for one left out. */
export interface ResponseBody {
    [key: string]: BodyValue
}

/** Every resource the header asks for. */
const RESOURCES = [
    'tracker/trackedEntities',
    'programs',
    'trackedEntityTypes',
    'organisationUnits',
    'tracker/relationships',
    'relationshipTypes',
    'trackedEntityAttributes',
]

/**
 * One handler answering every resource the header asks for, as
 * `CustomDataProvider` data. Its answer crosses the wire as JSON, so undefined
 * properties are left out.
 */
export const serve = (
    respond: (request: HeaderRequest) => object | Promise<object>
): CustomData =>
    Object.fromEntries(
        RESOURCES.map((resource) => [
            resource,
            async (_type: string, query: { resource: string }) => {
                const body = await respond(RequestSchema.parse(query))
                return BodySchema.parse(JSON.parse(JSON.stringify(body)))
            },
        ])
    )

/** A refused or failed request as app-runtime throws it: 401, 403 and 409 are `access` errors. */
export const requestFailure = (httpStatusCode: number) =>
    new FetchError({
        type: httpStatusCode === 403 ? 'access' : 'unknown',
        message: `HTTP ${httpStatusCode}`,
        details: { httpStatusCode },
    })

export const RMNCH = 'WSGAb5XwJ3Y'
export const CHILD = 'IpHINAT79UW'
/** The tracked entity the case relationships fixture is about. */
export const CASE_RECORD = 'k8TU70vWtnP'

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
    /** The links the record has: the case fixture's, the focus fixture's, or none. */
    links?: 'case' | 'focus' | 'none'
    /** Answers the relationships request alone with this status. */
    relationshipsFail?: 403 | 404 | 500
    /** Answers the relationships request with this body, in place of `links`. */
    relationshipsBody?: { relationships: object[] }
    /** Holds the relationships request open until `release` is called. */
    deferRelationships?: boolean
    /** Answers relationship types whose data views name no attributes. */
    bareTypes?: boolean
}

const BARE_TYPES = {
    relationshipTypes: relationshipTypes.relationshipTypes.map(
        ({ fromConstraint, toConstraint, ...type }) => ({
            ...type,
            fromConstraint: { ...fromConstraint, trackerDataView: undefined },
            toConstraint: { ...toConstraint, trackerDataView: undefined },
        })
    ),
}

const LINKS = {
    case: caseLinks,
    focus: focusLinks,
    none: { relationships: [] },
}

const PEOPLE = { rmnch: rmnchPerson, child: childPerson }
const PROGRAMS = { rmnch: rmnchProgram, child: childProgram }
const FIXTURE_OF_PROGRAM = new Map<string, Fixture>([
    [RMNCH, 'rmnch'],
    [CHILD, 'child'],
])

export const createFakeServer = (options: FakeServerOptions = {}) => {
    const requests: HeaderRequest[] = []
    let failing = options.fail
    let forbidden = options.forbidden
    let relationshipsFail = options.relationshipsFail
    let release = () => {}
    const held = new Promise<void>((resolve) => {
        release = resolve
    })
    const data = serve(async (request) => {
        requests.push(request)
        const program = request.params?.program
        // A person request names its program in the params, a program request in the id.
        const named = request.resource === 'programs' ? request.id : program
        const fixture =
            FIXTURE_OF_PROGRAM.get(String(named)) ?? options.fixture ?? 'rmnch'
        switch (request.resource) {
            case 'tracker/trackedEntities': {
                if (forbidden) {
                    throw requestFailure(403)
                }
                if (failing !== undefined) {
                    throw requestFailure(failing)
                }
                if (
                    options.deferFor !== undefined &&
                    [request.id, program].includes(options.deferFor)
                ) {
                    await held
                }
                const person =
                    program === undefined ? noProgramPerson : PEOPLE[fixture]
                return { ...person, trackedEntity: request.id }
            }
            case 'tracker/relationships':
                if (options.deferRelationships) {
                    await held
                }
                if (relationshipsFail !== undefined) {
                    throw requestFailure(relationshipsFail)
                }
                return (
                    options.relationshipsBody ?? LINKS[options.links ?? 'case']
                )
            case 'relationshipTypes':
                return options.bareTypes ? BARE_TYPES : relationshipTypes
            case 'trackedEntityAttributes':
                return viewAttributes
            case 'programs':
                return PROGRAMS[fixture]
            default:
                return personType
        }
    })
    const countOf = (resource: string) =>
        requests.filter((request) => request.resource === resource).length
    return {
        /** The DHIS2 resources the header asks for, for `createWrapper`. */
        data,
        requests,
        countOf,
        release,
        /** The server answers person requests again. */
        recover: () => {
            failing = undefined
        },
        /** From now on the server answers the relationships request with this status. */
        failRelationshipsWith: (status: 403 | 404 | 500) => {
            relationshipsFail = status
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

/**
 * `data` served through app-runtime's data engine, a fresh QueryClient, and a
 * Gregorian system. The hooks set their own retry rule, so retries come at once.
 */
export const createWrapper = (data: CustomData) => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retryDelay: 0 } },
    })
    const systemInfo = {
        version: '2.42.0',
        contextPath: '',
        serverTimeZoneId: 'UTC',
        calendar: 'gregorian',
    }
    return ({ children }: { children: ReactNode }) => (
        <Provider
            config={{ baseUrl: '..', apiVersion: 42, systemInfo }}
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
