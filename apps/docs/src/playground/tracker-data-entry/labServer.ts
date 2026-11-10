import { z } from 'zod'
import {
    generateLabData,
    LAB_USER,
    type LabData,
    type LabEnrollment,
    type LabEvent,
    type LabPerson,
    type LabSettings,
} from './labData'

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Record<string, string | number | boolean | undefined>
    data?: unknown
}

/** The params the lab answers by; the block's fields and modes don't change what it answers. */
const paramsSchema = z.object({
    program: z.string().optional(),
    orgUnit: z.string().optional(),
    orgUnits: z.string().optional(),
    events: z.string().optional(),
    enrollments: z.string().optional(),
    trackedEntities: z.string().optional(),
    enrolledAfter: z.string().optional(),
    enrolledBefore: z.string().optional(),
    order: z.string().optional(),
    page: z.coerce.number().default(1),
    pageSize: z.coerce.number().default(50),
})

type Params = z.infer<typeof paramsSchema>

const sentValue = z.string().nullable()

/** The flat import the block sends, checked for what the lab reads of it; the rest is kept as sent. */
const payloadSchema = z.object({
    trackedEntities: z
        .array(
            z.looseObject({
                trackedEntity: z.string(),
                attributes: z
                    .array(
                        z.object({ attribute: z.string(), value: sentValue })
                    )
                    .default([]),
            })
        )
        .default([]),
    enrollments: z.array(z.looseObject({ enrollment: z.string() })).default([]),
    events: z
        .array(
            z.looseObject({
                event: z.string(),
                enrollment: z.string().optional(),
                dataValues: z
                    .array(
                        z.object({ dataElement: z.string(), value: sentValue })
                    )
                    .default([]),
            })
        )
        .default([]),
})

export type Payload = z.input<typeof payloadSchema>

type RequestType = 'read' | 'create' | 'update' | 'replace' | 'delete'

/** Every resource the block asks for: the form's query, the rules, the reads before a save and the import. */
export const RESOURCES = [
    'programs',
    'tracker/events',
    'tracker/enrollments',
    'tracker/trackedEntities',
    'tracker',
    'me',
    'system/info',
    'programRules',
    'programRuleVariables',
    'constants',
]

/** The import: with Fails or Hangs the grid still loads, and its saves fail or never answer. */
export const RECORDS = ['tracker']

const REFUSAL = 'The lab’s DHIS2 refuses every change to this row.'

/** An error shaped like the ones app-runtime throws for an HTTP failure. */
const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

/** A comma-separated id list param, or undefined when the request has none. */
const ids = (value?: string) => value?.split(',')

const page = <T>(items: T[], { page, pageSize }: Params) => {
    const first = (page - 1) * pageSize
    return {
        items: items.slice(first, first + pageSize),
        pager: { page, pageSize },
    }
}

/** Held values with the sent ones merged in, as DHIS2 merges an update; a null or empty value deletes one. */
const merged = <T extends { value: string | null }>(
    held: T[],
    sent: T[],
    idOf: (item: T) => string
) =>
    [
        ...new Map(
            [...held, ...sent].map((item) => [idOf(item), item])
        ).values(),
    ].filter((item): item is T & { value: string } => Boolean(item.value))

const enrollmentJson = (data: LabData, enrollment: LabEnrollment) => ({
    ...enrollment,
    attributes: data.people.get(enrollment.trackedEntity)?.attributes ?? [],
    events: [...data.events.values()].filter(
        (each) => each.enrollment === enrollment.enrollment
    ),
})

const readEvents = (data: LabData, params: Params) => {
    const only = ids(params.events)
    const of = ids(params.enrollments)
    const found = [...data.events.values()].filter(
        (each) =>
            (params.program === undefined || each.program === params.program) &&
            (params.orgUnit === undefined || each.orgUnit === params.orgUnit) &&
            (only === undefined || only.includes(each.event)) &&
            (of === undefined || of.includes(each.enrollment ?? ''))
    )
    const dateOf = (each: LabEvent) => each.occurredAt ?? each.scheduledAt ?? ''
    const direction = params.order === 'occurredAt:asc' ? 1 : -1
    found.sort((a, b) => direction * dateOf(a).localeCompare(dateOf(b)))
    const { items, pager } = page(found, params)
    return { pager, events: items }
}

const readEnrollments = (data: LabData, params: Params) => {
    const only = ids(params.enrollments)
    const day = (each: LabEnrollment) => each.enrolledAt.slice(0, 10)
    const found = [...data.enrollments.values()]
        .filter(
            (each) =>
                (params.program === undefined ||
                    each.program === params.program) &&
                (params.orgUnits === undefined ||
                    each.orgUnit === params.orgUnits) &&
                (only === undefined || only.includes(each.enrollment)) &&
                day(each) >= (params.enrolledAfter ?? '') &&
                day(each) <= (params.enrolledBefore ?? '9999')
        )
        .sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt))
    const { items, pager } = page(found, params)
    return {
        pager,
        enrollments: items.map((each) => enrollmentJson(data, each)),
    }
}

const readPeople = (data: LabData, params: Params) => {
    const only = ids(params.trackedEntities)
    const found = [...data.people.values()].filter(
        (each) => only === undefined || only.includes(each.trackedEntity)
    )
    const { items, pager } = page(found, params)
    return {
        pager,
        trackedEntities: items.map((each) => ({
            ...each,
            enrollments: [...data.enrollments.values()]
                .filter(
                    ({ trackedEntity }) => trackedEntity === each.trackedEntity
                )
                .map((enrollment) => enrollmentJson(data, enrollment)),
        })),
    }
}

/**
 * Saves the import into the run's data, own fields replaced and values merged, but for the refused row, which it
 * reports as DHIS2 reports an object it will not save with `atomicMode=OBJECT`: HTTP 200, status OK, and an error
 * report naming it.
 */
const save = (
    data: LabData,
    refused: ReadonlySet<string>,
    payload: z.infer<typeof payloadSchema>
) => {
    const errorReports: Array<{
        errorCode: string
        message: string
        trackerType: string
        uid: string
    }> = []
    const stats = { created: 0, updated: 0 }
    const refuses = (trackerType: string, uid: string, parent = '') => {
        if (!refused.has(uid) && !refused.has(parent)) return false
        errorReports.push({
            errorCode: 'E1000',
            message: REFUSAL,
            trackerType,
            uid,
        })
        return true
    }
    const count = (isNew: boolean) =>
        isNew ? stats.created++ : stats.updated++
    for (const person of payload.trackedEntities) {
        const id = person.trackedEntity
        if (refuses('TRACKED_ENTITY', id)) continue
        const held = data.people.get(id)
        count(held === undefined)
        const attributes = merged(
            held?.attributes ?? [],
            person.attributes,
            ({ attribute }) => attribute
        )
        // SAFETY: the block sends whole people; the schema checks only what the lab reads.
        data.people.set(id, { ...person, attributes } as LabPerson)
    }
    for (const enrollment of payload.enrollments) {
        const id = enrollment.enrollment
        if (refuses('ENROLLMENT', id)) continue
        count(!data.enrollments.has(id))
        // SAFETY: the block sends whole enrolments; the schema checks only their id.
        data.enrollments.set(id, {
            ...enrollment,
            enrollment: id,
        } as LabEnrollment)
    }
    for (const event of payload.events) {
        const id = event.event
        if (refuses('EVENT', id, event.enrollment)) continue
        const held = data.events.get(id)
        count(held === undefined)
        const dataValues = merged(
            held?.dataValues ?? [],
            event.dataValues,
            ({ dataElement }) => dataElement
        )
        // SAFETY: the block sends whole events; the schema checks only what the lab reads.
        data.events.set(id, { ...event, dataValues } as LabEvent)
    }
    return {
        status: 'OK',
        validationReport: { errorReports, warningReports: [] },
        stats: {
            ...stats,
            deleted: 0,
            ignored: errorReports.length,
            total: stats.created + stats.updated + errorReports.length,
        },
        bundleReport: { typeReportMap: {} },
    }
}

/** What the lab's DHIS2 answers, from and into the run's data; how slowly, or whether at all, is the lab network's call. */
export const answer =
    (
        settings: Pick<LabSettings, 'example' | 'rules' | 'refuse'>,
        data: LabData = generateLabData(settings)
    ) =>
    (request: LabRequest, type: RequestType = 'read') => {
        const params = paramsSchema.parse(request.params ?? {})
        switch (request.resource) {
            case 'programs':
                if (request.id !== data.program.id) {
                    throw httpError(404, `Program ${request.id} not found`)
                }
                return data.program
            case 'tracker/events':
                return readEvents(data, params)
            case 'tracker/enrollments': {
                if (request.id === undefined)
                    return readEnrollments(data, params)
                const enrollment = data.enrollments.get(request.id)
                if (!enrollment) {
                    throw httpError(404, `Enrollment ${request.id} not found`)
                }
                return enrollmentJson(data, enrollment)
            }
            case 'tracker/trackedEntities':
                return readPeople(data, params)
            case 'tracker':
                if (type !== 'create') {
                    throw httpError(405, `The lab does not ${type} tracker`)
                }
                return save(
                    data,
                    new Set(settings.refuse ? data.refused : []),
                    payloadSchema.parse(request.data)
                )
            case 'me':
                return {
                    id: LAB_USER,
                    authorities: ['ALL'],
                    userRoles: [],
                    userGroups: [],
                }
            case 'system/info':
                return { calendar: 'iso8601', dateFormat: 'yyyy-MM-dd' }
            case 'programRules':
                return { programRules: settings.rules ? data.rules : [] }
            case 'programRuleVariables':
                return {
                    programRuleVariables: settings.rules ? data.variables : [],
                }
            case 'constants':
                return { constants: [] }
            default:
                throw new Error(
                    `The tracker data entry lab does not serve ${request.resource}`
                )
        }
    }
