import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React, { type ComponentProps } from 'react'
import { render } from 'vitest-browser-react'
import { z } from 'zod'
import {
    TrackedEntityRecordProvider,
    useTrackedEntityRecord,
    type JsonValue,
    type TrackedEntityRecord,
    type TrackedEntityRecordContextValue,
} from '..'
import orgUnitPaths from './fixtures/v42/org-unit-paths.json'
import personP1 from './fixtures/v42/person-P1.json'
import personP2 from './fixtures/v42/person-P2.json'
import personP3 from './fixtures/v42/person-P3.json'
import programs from './fixtures/v42/programs.json'
import relationshipTypes from './fixtures/v42/relationship-types.json'
import relationshipsP1 from './fixtures/v42/relationships-P1.json'
import trackedEntityType from './fixtures/v42/tracked-entity-type.json'
import userScopes from './fixtures/v42/user-scopes.json'

// The provider's test harness, a fake server: app-runtime's CustomDataProvider serves
// the recorded v42 fixtures through the real data engine (no module mocks).

export const P1 = 'TrE2eTei001'
export const P2 = 'TrE2eTei002'
export const P3 = 'TrE2eTei003'
export const MISSING = 'TrE2eMis001'
export const PRG_OPEN = 'TrE2ePrg001'
export const PRG_ONCE = 'TrE2ePrg002'
export const PRG_PROTECTED = 'TrE2ePrg003'

export const PERSON = 'tracker/trackedEntities'
const RESOURCES = [
    PERSON,
    'trackedEntityTypes',
    'programs',
    'tracker/relationships',
    'relationshipTypes',
    'me',
    'organisationUnits',
] as const
type Resource = (typeof RESOURCES)[number]

export const WAIT = { timeout: 5000 }

/** The part of the engine's resolved query the fake server reads. */
interface EngineQuery {
    id?: string
}
type Handler = (query: EngineQuery) => Promise<JsonValue>

/** Fixtures are served as the JSON they are. */
export const Json = z.json()

const RelationshipsQuerySchema = z.object({
    params: z.object({ trackedEntity: z.string() }),
})

/** What the data engine rejects with for an HTTP error answer. */
export const httpError = (
    status: number,
    message = `Server answered ${status}`
) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

export const notFoundMessage = (id: string) =>
    `TrackedEntity with id ${id} could not be found.`

const PERSONS = new Map<string, JsonValue>([
    [P1, Json.parse(personP1)],
    [P2, Json.parse(personP2)],
    [P3, Json.parse(personP3)],
])

const defaultHandlers = (): Map<Resource, Handler> =>
    new Map<Resource, Handler>([
        [
            PERSON,
            async ({ id = '' }) => {
                const person = PERSONS.get(id)
                if (person === undefined) {
                    throw httpError(404, notFoundMessage(id))
                }
                return person
            },
        ],
        ['trackedEntityTypes', async () => Json.parse(trackedEntityType)],
        ['programs', async () => Json.parse(programs)],
        [
            'tracker/relationships',
            async (query) =>
                RelationshipsQuerySchema.parse(query).params.trackedEntity ===
                P1
                    ? Json.parse(relationshipsP1)
                    : { relationships: [] },
        ],
        ['relationshipTypes', async () => Json.parse(relationshipTypes)],
        ['me', async () => Json.parse(userScopes)],
        ['organisationUnits', async () => Json.parse(orgUnitPaths)],
    ])

type CustomData = ComponentProps<typeof CustomDataProvider>['data']

export const createServer = () => {
    const calls = new Map<Resource, number>()
    let handlers = defaultHandlers()
    const data: CustomData = Object.fromEntries(
        RESOURCES.map((resource) => [
            resource,
            async (_type: string, query: EngineQuery) => {
                calls.set(resource, (calls.get(resource) ?? 0) + 1)
                const handler = handlers.get(resource)
                if (!handler) throw new Error(`No handler for ${resource}`)
                return handler(query)
            },
        ])
    )
    return {
        data,
        calls: (resource: Resource) => calls.get(resource) ?? 0,
        handle: (resource: Resource, handler: Handler) => {
            handlers.set(resource, handler)
        },
        reset: () => {
            handlers = defaultHandlers()
        },
    }
}
type FakeServer = ReturnType<typeof createServer>

interface RecordProps {
    trackedEntityId: string
    programs?: readonly string[]
}

/** Renders the provider under a fresh query client; records every value seen. */
const testQueryClient = () =>
    new QueryClient({
        defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    })

export const setup = (server: FakeServer, queryClient = testQueryClient()) => {
    const seen: TrackedEntityRecordContextValue[] = []
    const Probe = () => {
        seen.push(useTrackedEntityRecord())
        return null
    }
    const ui = (props: RecordProps) => (
        <CustomDataProvider data={server.data}>
            <QueryClientProvider client={queryClient}>
                <TrackedEntityRecordProvider
                    trackedEntityId={props.trackedEntityId}
                    programs={props.programs}
                >
                    <Probe />
                </TrackedEntityRecordProvider>
            </QueryClientProvider>
        </CustomDataProvider>
    )
    const latest = () => {
        const value = seen.at(-1)
        if (!value) throw new Error('The provider has not rendered yet')
        return value
    }
    return { seen, ui, latest }
}
type View = ReturnType<typeof setup>

export const waitForReady = (view: View, id?: string) =>
    vi.waitFor((): TrackedEntityRecord => {
        const { state } = view.latest()
        if (state.status !== 'ready') {
            throw new Error(`The state is ${state.status}`)
        }
        if (id !== undefined && state.record.person.id !== id) {
            throw new Error(`The record is ${state.record.person.id}`)
        }
        return state.record
    }, WAIT)

export const statusesSince = (view: View, from: number) =>
    view.seen.slice(from).map(({ state }) => state.status)

/** Review Focus 1: after P1 → P2, no render shows P1's record. */
export const expectNoPreviousPerson = async (view: View) => {
    const screen = await render(view.ui({ trackedEntityId: P1 }))
    await waitForReady(view, P1)
    const changedAt = view.seen.length

    await screen.rerender(view.ui({ trackedEntityId: P2 }))
    expect((await waitForReady(view, P2)).person.id).toBe(P2)

    const afterChange = view.seen.slice(changedAt)
    expect(afterChange.length).toBeGreaterThan(0)
    expect(
        afterChange.some(
            ({ state }) =>
                state.status === 'ready' && state.record.person.id === P1
        )
    ).toBe(false)
    expect(afterChange[0]?.state).toEqual({ status: 'pending' })
    expect(afterChange.every(({ meta }) => meta.trackedEntityId === P2)).toBe(
        true
    )
}
