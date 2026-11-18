import {
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    type LabConfig,
    type LabPerson,
    type World,
} from './labData'

type ParamValue =
    | string
    | number
    | boolean
    | readonly (string | number)[]
    | null
    | undefined

type Params = Readonly<Record<string, ParamValue>>

/** One request as the block sends it through app-runtime. */
export interface LabRequest {
    resource: string
    id?: string
    params?: Params
}

/** What the server's answers depend on. */
type ServerConfig = Pick<LabConfig, 'server'>

export const RESOURCES = ['tracker/trackedEntities']

const text = (value: ParamValue) =>
    value === undefined || value === null ? undefined : String(value)

/** Splits `value` at each `separator` the block did not escape with `/`, unescaping the parts when asked. */
const splitEscaped = (value: string, separator: string, unescape: boolean) => {
    const parts: string[] = []
    let current = ''
    for (let index = 0; index < value.length; index++) {
        const char = value[index]
        if (char === '/' && index + 1 < value.length) {
            current += unescape ? value[index + 1] : `/${value[index + 1]}`
            index++
        } else if (char === separator) {
            parts.push(current)
            current = ''
        } else {
            current += char
        }
    }
    parts.push(current)
    return parts
}

interface Condition {
    field: string
    operator: string
    value?: string
}

/** `uid:op:value[:op:value]` expressions, repeated or as one comma-joined string. */
export const parseFilters = (param: ParamValue): Condition[] => {
    if (param === undefined || param === null) return []
    const expressions = Array.isArray(param)
        ? param.map(String)
        : splitEscaped(String(param), ',', false)
    return expressions.flatMap((expression) => {
        const [field = '', ...tokens] = splitEscaped(expression, ':', true)
        const conditions: Condition[] = []
        for (let index = 0; index < tokens.length; index++) {
            const operator = tokens[index]?.toLowerCase() ?? ''
            if (operator === 'null' || operator === '!null') {
                conditions.push({ field, operator })
            } else {
                conditions.push({ field, operator, value: tokens[index + 1] })
                index++
            }
        }
        return conditions
    })
}

const isNumber = (value: string) => value.trim() !== '' && !isNaN(Number(value))

const compare = (left: string, right: string) =>
    isNumber(left) && isNumber(right)
        ? Number(left) - Number(right)
        : left.localeCompare(right)

const matches = (
    stored: string | undefined,
    { operator, value }: Condition
) => {
    const present = stored !== undefined && stored.trim() !== ''
    if (operator === 'null') return !present
    if (operator === '!null') return present
    if (!present || value === undefined) return false
    const left = stored.toLowerCase()
    const right = value.toLowerCase()
    switch (operator) {
        case 'like':
            return left.includes(right)
        case 'sw':
            return left.startsWith(right)
        case 'ew':
            return left.endsWith(right)
        case 'eq':
            return left === right
        case 'in':
            return right.split(';').includes(left)
        case 'gt':
            return compare(stored, value) > 0
        case 'ge':
            return compare(stored, value) >= 0
        case 'lt':
            return compare(stored, value) < 0
        case 'le':
            return compare(stored, value) <= 0
        default:
            return true
    }
}

/** What a field reads for one person, by the name the block sends in `filter` and `order`. */
const valueOf = (person: LabPerson, field: string): string | undefined => {
    switch (field) {
        case 'trackedEntity':
            return person.id
        case 'createdAt':
        case 'updatedAt':
            return person.createdAt
        case 'enrolledAt':
            return person.enrolledAt
        case 'inactive':
            return 'false'
        default:
            return person.attributes[field]
    }
}

/** Whether `stamp` passes the request's after/before pair, by date. */
const inWindow = (
    stamp: string,
    params: Params,
    after: string,
    before: string
) => {
    const start = text(params[after])?.slice(0, 10)
    const end = text(params[before])?.slice(0, 10)
    const date = stamp.slice(0, 10)
    return (!start || date >= start) && (!end || date <= end)
}

const sorted = (people: LabPerson[], order: string | undefined) => {
    if (!order) return people
    const keys = order.split(',').map((each) => {
        const [field = '', direction] = each.split(':')
        return { field, sign: direction === 'desc' ? -1 : 1 }
    })
    return [...people].sort((left, right) => {
        for (const { field, sign } of keys) {
            const a = valueOf(left, field)
            const b = valueOf(right, field)
            // Empty values sort last either way, as DHIS2 sorts them.
            if (a === undefined || b === undefined) {
                if (a !== b) return a === undefined ? 1 : -1
                continue
            }
            const difference = compare(a, b)
            if (difference) return difference * sign
        }
        return 0
    })
}

const trackedEntityJson = (person: LabPerson) => ({
    trackedEntity: person.id,
    orgUnit: LAB_ORG_UNIT,
    createdAt: person.createdAt,
    updatedAt: person.createdAt,
    inactive: false,
    attributes: Object.entries(person.attributes).flatMap(
        ([attribute, value]) =>
            value === undefined ? [] : [{ attribute, value }]
    ),
    enrollments: [
        {
            enrollment: `${person.id}En`,
            program: LAB_PROGRAM,
            status: person.enrollmentStatus,
            enrolledAt: person.enrolledAt,
            occurredAt: person.occurredAt,
            orgUnit: LAB_ORG_UNIT,
        },
    ],
})

/** The people a request asks for, before paging. */
const found = (world: World, params: Params) => {
    if (
        text(params.program) !== LAB_PROGRAM ||
        !text(params.orgUnits)?.split(/[;,]/).includes(LAB_ORG_UNIT)
    ) {
        return []
    }
    const conditions = parseFilters(params.filter)
    const status = text(params.enrollmentStatus ?? params.programStatus)
    return sorted(
        world.people.filter(
            (person) =>
                conditions.every((condition) =>
                    matches(valueOf(person, condition.field), condition)
                ) &&
                (!status || person.enrollmentStatus === status) &&
                inWindow(
                    person.enrolledAt,
                    params,
                    'enrollmentEnrolledAfter',
                    'enrollmentEnrolledBefore'
                ) &&
                inWindow(
                    person.occurredAt,
                    params,
                    'enrollmentOccurredAfter',
                    'enrollmentOccurredBefore'
                )
        ),
        text(params.order)
    )
}

/**
 * A fake `tracker/trackedEntities` for one run of the lab. It honours
 * `program`, `orgUnits`, `page` (from 1), `pageSize`, `order`, repeated
 * `filter`, `enrollmentStatus` or `programStatus` and the enrollment date
 * pairs, and answers in the form of the API version: `trackedEntities` with a
 * `pager` on 2.42 and later, `instances` with the page at the top on 2.41.
 */
export const createLabServer =
    ({ server }: ServerConfig, world: World) =>
    (request: LabRequest) => {
        // An array, which no version of DHIS2 sends here.
        if (server.response === 'malformed') {
            return [{ trackedEntity: 'labTe000000' }]
        }
        const params = request.params ?? {}
        const people =
            server.query === 'honoured' ? found(world, params) : world.people
        const page = Number(params.page ?? 1)
        const pageSize = Number(params.pageSize ?? 50)
        const first = (page - 1) * pageSize
        const items = (
            server.query === 'honoured'
                ? people.slice(first, first + pageSize)
                : people
        ).map(trackedEntityJson)
        if (server.apiVersion < 42) {
            return { instances: items, page, pageSize }
        }
        const more = first + pageSize < people.length
        return {
            trackedEntities: items,
            pager: more
                ? { page, pageSize, nextPage: `next?page=${page + 1}` }
                : { page, pageSize },
        }
    }
