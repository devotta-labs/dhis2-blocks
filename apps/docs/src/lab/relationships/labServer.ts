import type { DataEngineQueryParameters } from '@/components/relationship-viewer/api/client'
import {
    ATTRIBUTES,
    DATA_ELEMENTS,
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    LAB_STAGE,
    PERSON_TYPE,
    RELATIONSHIP_TYPES,
    type LabLink,
    type LabPerson,
    type World,
} from './labData'

export interface LabServer {
    latency: number // ms per request
    metadata: 'ok' | 'fails'
}

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: DataEngineQueryParameters
}

export interface RequestLogEntry {
    id: number
    at: string
    request: LabRequest
    ms?: number
    outcome: 'pending' | 'ok' | 'failed'
    detail?: string
}

/** Thrown like the app-runtime's errors, with the status the block reads. */
const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status },
    })

const NAMES = new Map<string, string>([
    [ATTRIBUTES.firstName, 'First name'],
    [ATTRIBUTES.lastName, 'Last name'],
    [ATTRIBUTES.sex, 'Sex'],
    [ATTRIBUTES.age, 'Age'],
    [ATTRIBUTES.village, 'Village'],
    [ATTRIBUTES.classification, 'Case classification'],
    [ATTRIBUTES.lastFollowUp, 'Last follow-up'],
])

const personJson = (person: LabPerson) => ({
    trackedEntity: person.id,
    trackedEntityType: PERSON_TYPE,
    attributes: Object.entries(person.attributes).map(([attribute, value]) => ({
        attribute,
        displayName: NAMES.get(attribute),
        value,
    })),
    enrollments: [
        {
            enrollment: `${person.id}En`,
            program: person.program,
            status: person.status,
            followUp: person.followUp,
            enrolledAt: person.enrolledAt,
            occurredAt: person.occurredAt,
        },
    ],
})

const itemJson = ({ kind, id }: LabLink['from']) =>
    kind === 'event'
        ? { event: { event: id } }
        : { trackedEntity: { trackedEntity: id } }

const relationshipJson = (link: LabLink) => ({
    relationship: link.id,
    relationshipType: link.type,
    bidirectional: link.bidirectional,
    createdAt: link.createdAt,
    from: itemJson(link.from),
    to: itemJson(link.to),
})

const nameView = {
    attributes: [ATTRIBUTES.firstName, ATTRIBUTES.lastName],
    dataElements: [],
}
const personSide = {
    relationshipEntity: 'TRACKED_ENTITY_INSTANCE',
    trackerDataView: nameView,
}

const personType = (type: {
    id: string
    name: string
    bidirectional: boolean
}) => ({
    id: type.id,
    displayName: type.name,
    bidirectional: type.bidirectional,
    fromConstraint: personSide,
    toConstraint: personSide,
})

const metadataJson = {
    relationshipTypes: [
        personType(RELATIONSHIP_TYPES.contact),
        personType(RELATIONSHIP_TYPES.household),
        {
            id: RELATIONSHIP_TYPES.labResult.id,
            displayName: RELATIONSHIP_TYPES.labResult.name,
            bidirectional: false,
            fromConstraint: personSide,
            toConstraint: {
                relationshipEntity: 'PROGRAM_STAGE_INSTANCE',
                trackerDataView: {
                    attributes: [],
                    dataElements: [DATA_ELEMENTS.test, DATA_ELEMENTS.result],
                },
            },
        },
    ],
}

const wait = (ms: number, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        if (ms <= 0) return resolve()
        const timer = setTimeout(resolve, ms)
        signal?.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
        })
    })

const PAGE_SIZE = 50

/** What DHIS2 would answer for one request, from the lab's world. */
export async function answer(
    world: World,
    server: LabServer,
    { resource, id, params = {} }: LabRequest,
    signal?: AbortSignal
) {
    await wait(server.latency, signal)
    switch (resource) {
        case 'relationshipTypes':
            if (server.metadata === 'fails') {
                throw httpError(500, 'Internal server error')
            }
            return metadataJson
        case 'trackedEntityTypes':
            return {
                trackedEntityTypes: [
                    {
                        id: PERSON_TYPE,
                        trackedEntityTypeAttributes: [
                            ATTRIBUTES.firstName,
                            ATTRIBUTES.lastName,
                        ].map((attribute) => ({
                            displayInList: true,
                            trackedEntityAttribute: { id: attribute },
                        })),
                    },
                ],
            }
        case 'tracker/trackedEntities': {
            if (id === undefined) {
                // A seed query: everyone enrolled in the program at the org unit, paged.
                const page = Number(params.page ?? 1)
                const matches =
                    params.program === LAB_PROGRAM &&
                    String(params.orgUnits ?? LAB_ORG_UNIT) === LAB_ORG_UNIT
                const all = matches
                    ? [...world.people.values()].filter(
                          (person) => person.program === LAB_PROGRAM
                      )
                    : []
                return {
                    trackedEntities: all
                        .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
                        .map((person) => ({ trackedEntity: person.id })),
                }
            }
            const person = world.people.get(id)
            if (!person || world.failing.has(id)) {
                throw httpError(404, `Tracked entity ${id} not found`)
            }
            // DHIS2 42+ answers 404 for a program the person is not enrolled in.
            if (
                params.program !== undefined &&
                params.program !== person.program
            ) {
                throw httpError(
                    404,
                    `${id} is not enrolled in ${String(params.program)}`
                )
            }
            return personJson(person)
        }
        case 'tracker/events': {
            const event = id === undefined ? undefined : world.events.get(id)
            if (!event) throw httpError(404, `Event ${id} not found`)
            return {
                event: event.id,
                program: LAB_PROGRAM,
                programStage: LAB_STAGE,
                occurredAt: event.occurredAt,
                dataValues: [
                    { dataElement: DATA_ELEMENTS.test, value: event.test },
                    { dataElement: DATA_ELEMENTS.result, value: event.result },
                ],
            }
        }
        case 'tracker/relationships': {
            const of = String(params.trackedEntity ?? params.event ?? '')
            return {
                relationships: world.links
                    .filter((link) => link.from.id === of || link.to.id === of)
                    .map(relationshipJson),
            }
        }
        default:
            throw httpError(404, `The lab server has no ${resource}`)
    }
}

type Log = (update: (entries: RequestLogEntry[]) => RequestLogEntry[]) => void

let nextLogId = 0

/** `answer`, with each request added to the log and settled when it returns. */
export async function answerLogged(
    world: World,
    server: LabServer,
    request: LabRequest,
    log: Log,
    signal?: AbortSignal
) {
    const id = ++nextLogId
    const started = performance.now()
    const settle = (outcome: RequestLogEntry['outcome'], detail?: string) =>
        log((entries) =>
            entries.map((entry) =>
                entry.id === id
                    ? {
                          ...entry,
                          outcome,
                          detail,
                          ms: Math.round(performance.now() - started),
                      }
                    : entry
            )
        )
    log((entries) =>
        [
            {
                id,
                at: new Date().toLocaleTimeString(),
                request,
                outcome: 'pending' as const,
            },
            ...entries,
        ].slice(0, 200)
    )
    try {
        const result = await answer(world, server, request, signal)
        settle('ok')
        return result
    } catch (error) {
        settle('failed', error instanceof Error ? error.message : 'Failed')
        throw error
    }
}
