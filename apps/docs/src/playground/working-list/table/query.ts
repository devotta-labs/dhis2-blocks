import type { DataEngineQueryParameters } from '@/components/working-list/api/client'
import { LAB_ORG_UNIT, type LabPerson } from './labData'

type Params = DataEngineQueryParameters

const text = (value: Params[string]) =>
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

/** `id:op:value[:op:value]` expressions, as an array or one comma-joined string. */
export const parseFilters = (param: Params[string]): Condition[] => {
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

export const matches = (
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
export const valueOf = (
    person: LabPerson,
    field: string
): string | undefined => {
    switch (field) {
        case 'enrolledAt':
            return person.enrolledAt
        case 'enrollmentOccurredAt':
            return person.occurredAt
        case 'enrollmentStatus':
            return person.enrollmentStatus
        case 'createdAt':
            return person.createdAt
        case 'programOwner':
        case 'orgUnit':
            return LAB_ORG_UNIT
        case 'occurredAt':
            return person.visit.occurredAt
        case 'scheduledAt':
            return person.visit.scheduledAt
        case 'status':
            return person.visit.status
        default:
            return person.attributes[field] ?? person.visit.dataValues[field]
    }
}

/** Whether `stamp` passes the request's after/before pair, by date. */
export const inWindow = (
    stamp: string | undefined,
    params: Params,
    after: string,
    before: string
) => {
    const start = text(params[after])?.slice(0, 10)
    const end = text(params[before])?.slice(0, 10)
    if (!start && !end) return true
    const date = stamp?.slice(0, 10)
    if (!date) return false
    return (!start || date >= start) && (!end || date <= end)
}

export const sorted = (people: LabPerson[], order: string | undefined) => {
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
