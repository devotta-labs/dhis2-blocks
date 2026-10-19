import type * as Engine from '@dhis2/rule-engine'
import { Result } from 'better-result'
import type { RuleEngineModule } from './types'

const NUMERIC = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])
const BOOLEAN = new Set(['BOOLEAN', 'TRUE_ONLY'])
const DATE = new Set(['DATE', 'DATETIME', 'AGE'])

export const ruleValueType = (
    engine: RuleEngineModule,
    valueType: string | undefined
): Engine.RuleValueType => {
    if (valueType === undefined) {
        return engine.RuleValueType.TEXT
    }
    if (NUMERIC.has(valueType)) {
        return engine.RuleValueType.NUMERIC
    }
    if (BOOLEAN.has(valueType)) {
        return engine.RuleValueType.BOOLEAN
    }
    return DATE.has(valueType)
        ? engine.RuleValueType.DATE
        : engine.RuleValueType.TEXT
}

const DATE_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/

/** `yyyy-MM-dd` from a tracker (ISO) date or timestamp, or null when it isn't a real date. */
const datePart = (value: string): string | null => {
    const match = DATE_PREFIX.exec(value)
    if (match === null) {
        return null
    }
    const [date, year, month, day] = match
    const parsed = new Date(Date.UTC(+year, +month - 1, +day))
    const real =
        parsed.getUTCFullYear() === +year &&
        parsed.getUTCMonth() === +month - 1 &&
        parsed.getUTCDate() === +day
    return real ? date : null
}

/**
 * A stored value as the engine parses it: empty → null (d2:hasValue is true
 * for ''), date-like types cut to yyyy-MM-dd (a DATETIME read through a DATE
 * variable otherwise fails to coerce and the rule is skipped silently).
 */
export const normaliseValue = (
    value: string | undefined,
    valueType: string | undefined
): string | null => {
    if (value === undefined || value === '') {
        return null
    }
    return valueType !== undefined && DATE.has(valueType)
        ? datePart(value)
        : value
}

/** Never throws: a half-typed date is treated as missing. */
export const toLocalDate = (
    engine: RuleEngineModule,
    value: string | undefined
): Engine.RuleLocalDate | null => {
    const date = value === undefined ? null : datePart(value)
    return date === null
        ? null
        : Result.try(() => engine.RuleLocalDate.parse(date)).unwrapOr(null)
}

const HAS_OFFSET = /(?:Z|[+-]\d\d:?\d\d)$/

/** Tracker timestamps carry no offset; they are server time, taken as UTC. */
export const toInstant = (
    engine: RuleEngineModule,
    value: string | undefined
): Engine.RuleInstant | null => {
    if (value === undefined || datePart(value) === null) {
        return null
    }
    const withOffset = HAS_OFFSET.test(value) ? value : `${value}Z`
    return Result.try(() => engine.RuleInstant.parse(withOffset)).unwrapOr(null)
}
