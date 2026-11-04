import type { LabNetwork } from '../network'
import {
    generateLabData,
    LAB_PERSON,
    type LabChangeLogRow,
    type LabData,
    type LabEvent,
    type LabSettings,
} from './labData'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Record<string, string | number | boolean>
}

/**
 * The resources the block asks for by name. The changelogs carry their
 * record's id in the resource itself, so `resourcesOf` adds one per record.
 * The calendar comes from app-runtime's config, not a request.
 */
const RESOURCES = [
    'tracker/trackedEntities',
    'tracker/events',
    'programs',
    'organisationUnits',
] as const

const attributeChangeLogOf = (trackedEntity: string) =>
    `tracker/trackedEntities/${trackedEntity}/changeLogs`

const eventChangeLogOf = (event: string) => `tracker/events/${event}/changeLogs`

/** Every resource the block can ask the lab for: `RESOURCES`, the person's changelog and each event's. */
export const resourcesOf = (data: LabData): string[] => [
    ...RESOURCES,
    attributeChangeLogOf(LAB_PERSON),
    ...data.events.map(({ event }) => eventChangeLogOf(event)),
]

/** The resources that fail, for the part of the history the lab breaks. */
const failingResources = (settings: LabSettings, data: LabData): string[] => {
    switch (settings.failing) {
        case 'changes':
            return [
                attributeChangeLogOf(LAB_PERSON),
                ...data.events.map(({ event }) => eventChangeLogOf(event)),
            ]
        case 'metadata':
            return ['programs']
        case 'orgUnits':
            return ['organisationUnits']
        case 'events':
            return ['tracker/events']
        default:
            return []
    }
}

/** The lab's network with the broken part's requests failing too. */
export const labNetwork = (
    settings: LabSettings,
    data: LabData
): LabNetwork => ({
    ...settings.network,
    endpoints: {
        ...settings.network.endpoints,
        ...Object.fromEntries(
            failingResources(settings, data).map((resource) => [
                resource,
                {
                    ...settings.network.endpoints[resource],
                    behaviour: 'fails' as const,
                },
            ])
        ),
    },
})

/** An error shaped like the ones app-runtime throws for an HTTP failure. */
const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

const paged = <T>(items: readonly T[], params: LabRequest['params'] = {}) => {
    const page = Number(params.page ?? 1)
    const pageSize = Number(params.pageSize ?? 50)
    const first = (page - 1) * pageSize
    return {
        items: items.slice(first, first + pageSize),
        pager: { page, pageSize },
    }
}

/** The event's value for an `order` field; fields the lab doesn't sort by have none. */
const sortValue = (event: LabEvent, field: string): string | undefined => {
    switch (field) {
        case 'event':
            return event.event
        case 'occurredAt':
            return event.occurredAt
        case 'scheduledAt':
            return event.scheduledAt
        case 'completedAt':
            return event.completedAt
        case 'createdAt':
            return event.createdAt
        case 'updatedAt':
            return event.updatedAt
        default:
            return undefined
    }
}

/**
 * Sorts events by `order` (`field:dir,…`) as Postgres does: text compared as
 * stored, no value last when ascending and first when descending.
 */
const sortEvents = (events: readonly LabEvent[], order: string) => {
    const keys = order
        .split(',')
        .map((part) => part.split(':'))
        .flatMap(([field, direction]) =>
            field ? [{ field, desc: direction === 'desc' }] : []
        )
    return [...events].sort((a, b) => {
        for (const { field, desc } of keys) {
            const left = sortValue(a, field)
            const right = sortValue(b, field)
            if (left === right) continue
            if (left === undefined) return desc ? -1 : 1
            if (right === undefined) return desc ? 1 : -1
            const compared = left < right ? -1 : 1
            return desc ? -compared : compared
        }
        return 0
    })
}

const changeLogPage = (
    rows: readonly LabChangeLogRow[],
    params: LabRequest['params']
) => {
    const { items, pager } = paged(rows, params)
    return { pager, changeLogs: items }
}

/** `filter=id:in:[a,b]` as a list of ids. */
const idsIn = (filter: string) =>
    /^id:in:\[(.*)\]$/.exec(filter)?.[1]?.split(',').filter(Boolean) ?? []

/** What the lab's DHIS2 answers; how slowly, or whether at all, is the lab network's call. */
export const answer =
    (settings: LabSettings, data: LabData = generateLabData(settings)) =>
    (request: LabRequest) => {
        const params = request.params ?? {}
        const { resource } = request

        if (resource === attributeChangeLogOf(LAB_PERSON)) {
            if (settings.changelog === 'unsupported')
                throw httpError(404, 'Not found')
            const program = String(params.program ?? '')
            return changeLogPage(
                data.attributeChanges.get(program) ?? [],
                params
            )
        }
        const eventChangeLog = /^tracker\/events\/([^/]+)\/changeLogs$/.exec(
            resource
        )
        if (eventChangeLog) {
            if (settings.changelog === 'unsupported')
                throw httpError(404, 'Not found')
            const rows =
                settings.changelog === 'none'
                    ? []
                    : (data.eventChanges.get(eventChangeLog[1] ?? '') ?? [])
            return changeLogPage(rows, params)
        }

        switch (resource) {
            case 'tracker/trackedEntities':
                if (request.id !== LAB_PERSON) {
                    throw httpError(
                        404,
                        `TrackedEntity with id ${request.id} could not be found.`
                    )
                }
                return data.trackedEntity
            case 'tracker/events': {
                const theirs = data.events.filter(
                    (event) =>
                        event.trackedEntity === params.trackedEntity &&
                        (params.program === undefined ||
                            event.program === params.program)
                )
                const { items, pager } = paged(
                    sortEvents(
                        theirs,
                        String(params.order ?? 'occurredAt:desc')
                    ),
                    params
                )
                return { pager, events: items }
            }
            case 'programs': {
                const program =
                    request.id === undefined
                        ? undefined
                        : data.programs.get(request.id)
                if (!program) {
                    throw httpError(
                        404,
                        `Program with id ${request.id} could not be found.`
                    )
                }
                return program
            }
            case 'organisationUnits':
                return {
                    organisationUnits: idsIn(
                        String(params.filter ?? '')
                    ).flatMap((id) => {
                        const displayName = data.orgUnits.get(id)
                        return displayName === undefined
                            ? []
                            : [{ id, displayName }]
                    }),
                }
            default:
                throw new Error(`The timeline lab does not serve ${resource}`)
        }
    }
