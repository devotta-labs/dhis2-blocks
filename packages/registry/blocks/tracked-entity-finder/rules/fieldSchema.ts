import { z } from 'zod'
import type {
    FieldErrorCode,
    FieldValue,
    FinderAttribute,
    FormField,
    SearchCondition,
} from './types'

type Match = FormField['match']

/** What a field sends: its conditions, or nothing when it is left empty. */
export type FieldConditions = readonly SearchCondition[] | undefined

/** Every error a field schema can raise; each is its Zod issue's `message`. */
const FIELD_ERROR_CODES = [
    'too-short',
    'invalid-number',
    'not-integer',
    'invalid-date',
    'reversed',
] as const satisfies readonly FieldErrorCode[]

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/
const INTEGER = /^[+-]?\d+$/

const DAY_START = 'T00:00:00.000'
const DAY_END = 'T23:59:59.999'

/** Trimmed text, or undefined when there is none. */
const trimmed = z.string().transform((text) => text.trim() || undefined)

/** As `trimmed`, for a side that may be unset. */
const optionalTrimmed = z
    .string()
    .optional()
    .transform((text) => text?.trim() || undefined)

/** A number as typed, sent unchanged; integer value types refuse decimals. */
const numberText = (attribute: FinderAttribute) =>
    trimmed.pipe(
        z
            .string()
            .regex(NUMBER, { error: 'invalid-number' satisfies FieldErrorCode })
            // Read from the text: `Number` rounds "1.0" and long decimals to integers.
            .refine(
                (text) =>
                    !attribute.valueType.startsWith('INTEGER') ||
                    INTEGER.test(text),
                { error: 'not-integer' satisfies FieldErrorCode }
            )
            .optional()
    )

/** An ISO `yyyy-mm-dd` day that exists. */
const dateText = optionalTrimmed.pipe(
    z.iso.date({ error: 'invalid-date' satisfies FieldErrorCode }).optional()
)

const notReversed = <T>(
    low: T | undefined,
    high: T | undefined,
    order: (side: T) => number | string
) => low === undefined || high === undefined || order(low) <= order(high)

/** Either side alone fills; both send `ge` and `le`. */
const rangeConditions = (
    low: string | undefined,
    high: string | undefined
): FieldConditions => {
    const conditions: SearchCondition[] = []
    if (low !== undefined) {
        conditions.push({ op: 'ge', value: low })
    }
    if (high !== undefined) {
        conditions.push({ op: 'le', value: high })
    }
    return conditions.length ? conditions : undefined
}

const eq = (value: string): FieldConditions => [{ op: 'eq', value }]

/** The `FieldValue` kind a field of this attribute and match holds. */
const kindFor = (
    attribute: FinderAttribute,
    match: Match
): FieldValue['kind'] | undefined => {
    switch (attribute.kind) {
        case 'text':
        case 'option':
        case 'boolean':
        case 'trueOnly':
            return match === 'exact' ? attribute.kind : undefined
        case 'number':
            return match === 'exact' ? 'number' : 'numberRange'
        case 'date':
        case 'dateTime':
            return match === 'exact' ? 'date' : 'dateRange'
        case 'unsupported':
            return undefined
    }
}

/** The schema for one kind of `FieldValue`. */
const valueSchema = (
    attribute: FinderAttribute,
    kind: FieldValue['kind']
): z.ZodType<FieldConditions, FieldValue> => {
    const dayBound = (day: string, side: 'from' | 'to') =>
        attribute.kind === 'dateTime'
            ? day + (side === 'from' ? DAY_START : DAY_END)
            : day
    switch (kind) {
        case 'text': {
            const op = attribute.unique ? 'eq' : attribute.textOperator
            return z
                .object({ kind: z.literal('text'), text: trimmed })
                .transform(({ text }) => text)
                .pipe(
                    z
                        .string()
                        .min(attribute.minCharacters, {
                            error: 'too-short' satisfies FieldErrorCode,
                        })
                        .optional()
                )
                .transform((text): FieldConditions =>
                    text !== undefined && op ? [{ op, value: text }] : undefined
                )
        }
        case 'option':
            return z
                .object({
                    kind: z.literal('option'),
                    code: z.string().optional(),
                })
                .transform(({ code }) =>
                    code !== undefined &&
                    attribute.options?.some((option) => option.code === code)
                        ? eq(code)
                        : undefined
                )
        case 'boolean':
            return z
                .object({
                    kind: z.literal('boolean'),
                    value: z.enum(['true', 'false']).optional(),
                })
                .transform(({ value }) => (value ? eq(value) : undefined))
        case 'trueOnly':
            return z
                .object({ kind: z.literal('trueOnly'), checked: z.boolean() })
                .transform(({ checked }) => (checked ? eq('true') : undefined))
        case 'number':
            return z
                .object({
                    kind: z.literal('number'),
                    value: numberText(attribute),
                })
                .transform(({ value }) =>
                    value === undefined ? undefined : eq(value)
                )
        case 'numberRange':
            return z
                .object({
                    kind: z.literal('numberRange'),
                    min: numberText(attribute),
                    max: numberText(attribute),
                })
                .refine(({ min, max }) => notReversed(min, max, Number), {
                    error: 'reversed' satisfies FieldErrorCode,
                })
                .transform(({ min, max }) => rangeConditions(min, max))
        case 'date':
            return z
                .object({ kind: z.literal('date'), date: dateText })
                .transform(({ date }) => {
                    if (date === undefined) {
                        return undefined
                    }
                    // A DATETIME is searched across the whole day.
                    return attribute.kind === 'dateTime' && !attribute.unique
                        ? rangeConditions(
                              dayBound(date, 'from'),
                              dayBound(date, 'to')
                          )
                        : eq(date)
                })
        case 'dateRange':
            return z
                .object({
                    kind: z.literal('dateRange'),
                    from: dateText,
                    to: dateText,
                })
                .refine(({ from, to }) => notReversed(from, to, String), {
                    error: 'reversed' satisfies FieldErrorCode,
                })
                .transform(({ from, to }) =>
                    rangeConditions(
                        from && dayBound(from, 'from'),
                        to && dayBound(to, 'to')
                    )
                )
    }
}

/**
 * One field's value against its attribute: the conditions it sends, nothing
 * when empty, or a `FieldErrorCode` as the message of its first Zod issue. A value
 * of another kind than the field holds is read as empty.
 */
export const fieldSchema = (
    attribute: FinderAttribute,
    match: Match
): z.ZodType<FieldConditions, FieldValue | undefined> => {
    const kind = kindFor(attribute, match)
    const holds = kind ? valueSchema(attribute, kind) : z.undefined()
    return z
        .custom<FieldValue | undefined>()
        .transform((value) => (value?.kind === kind ? value : undefined))
        .pipe(holds.optional())
}

/** The `FieldErrorCode` a failed field parse reports. */
export const errorCodeOf = (error: z.ZodError): FieldErrorCode | undefined => {
    const message = error.issues[0]?.message
    return FIELD_ERROR_CODES.find((code) => code === message)
}
