import type { DataElementMeta } from '../api/schemas'

export type WidgetKind =
    | 'text'
    | 'longText'
    | 'number'
    | 'choice'
    | 'select'
    | 'multiSelect'
    | 'trueOnly'
    | 'date'
    | 'dateTime'
    | 'time'
    | 'age'
    | 'coordinate'
    | 'orgUnit'
    | 'unsupported'

export type InputMode = 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url'

/** `message` is an untranslated key; the UI passes it through the translate context. */
export interface ValueError {
    code: string
    message: string
}

export interface ValueTypeSpec {
    kind: WidgetKind
    inputMode?: InputMode
    validate(value: string): ValueError | null
}

export type UnsupportedReason = 'valueType' | 'noOptions'

export interface AnswerChoice {
    value: string
    label: string
}

/** Option sets with more options than this are picked from a dropdown instead of shown inline. */
const MAX_INLINE_CHOICES = 5

const error = (code: string, message: string): ValueError => ({
    code,
    message,
})

type Validator = (value: string) => ValueError | null

const INTEGER = /^-?\d+$/
const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME =
    /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/
const TIME = /^(\d{2}):(\d{2})$/
const COORDINATE = /^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
const PHONE = /^\+?[\d\s().-]*\d[\d\s().-]*$/
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/
const URL_PROTOCOLS = new Set(['http:', 'https:', 'ftp:'])

const isRealDate = (year: number, month: number, day: number): boolean => {
    const date = new Date(Date.UTC(year, month - 1, day))
    return (
        date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
    )
}

const isDate = (value: string): boolean => {
    const match = DATE.exec(value)
    return (
        match !== null &&
        isRealDate(Number(match[1]), Number(match[2]), Number(match[3]))
    )
}

const isClockTime = (hours: number, minutes: number, seconds = 0): boolean =>
    hours <= 23 && minutes <= 59 && seconds <= 59

const integerValidator =
    (
        accepts: (n: number) => boolean,
        code: string,
        message: string
    ): Validator =>
    (value) =>
        INTEGER.test(value) && accepts(Number(value))
            ? null
            : error(code, message)

const numberInRange =
    (min: number, max: number, code: string, message: string): Validator =>
    (value) => {
        const number = Number(value)
        return NUMBER.test(value) && number >= min && number <= max
            ? null
            : error(code, message)
    }

const NOT_A_NUMBER = error('number', 'Enter a number')

const VALIDATORS = new Map(
    Object.entries({
        INTEGER: integerValidator(
            () => true,
            'integer',
            'Enter a whole number'
        ),
        INTEGER_POSITIVE: integerValidator(
            (n) => n > 0,
            'integerPositive',
            'Enter a whole number greater than zero'
        ),
        INTEGER_NEGATIVE: integerValidator(
            (n) => n < 0,
            'integerNegative',
            'Enter a whole number less than zero'
        ),
        INTEGER_ZERO_OR_POSITIVE: integerValidator(
            (n) => n >= 0,
            'integerZeroOrPositive',
            'Enter a whole number of zero or more'
        ),
        NUMBER: (value) =>
            NUMBER.test(value) && Number.isFinite(Number(value))
                ? null
                : NOT_A_NUMBER,
        PERCENTAGE: numberInRange(
            0,
            100,
            'percentage',
            'Enter a percentage between 0 and 100'
        ),
        UNIT_INTERVAL: numberInRange(
            0,
            1,
            'unitInterval',
            'Enter a number between 0 and 1'
        ),
        LETTER: (value) =>
            /^\p{L}$/u.test(value)
                ? null
                : error('letter', 'Enter a single letter'),
        EMAIL: (value) =>
            EMAIL.test(value)
                ? null
                : error('email', 'Enter a valid email address'),
        PHONE_NUMBER: (value) =>
            PHONE.test(value)
                ? null
                : error('phoneNumber', 'Enter a valid phone number'),
        URL: (value) => {
            try {
                return URL_PROTOCOLS.has(new URL(value).protocol)
                    ? null
                    : error('url', 'Enter a valid URL')
            } catch {
                return error('url', 'Enter a valid URL')
            }
        },
        DATE: (value) =>
            isDate(value) ? null : error('date', 'Enter a valid date'),
        DATETIME: (value) => {
            const match = DATE_TIME.exec(value)
            return match !== null &&
                isDate(match[1]) &&
                isClockTime(
                    Number(match[2]),
                    Number(match[3]),
                    Number(match[4] ?? 0)
                )
                ? null
                : error('dateTime', 'Enter a valid date and time')
        },
        TIME: (value) => {
            const match = TIME.exec(value)
            return match !== null &&
                isClockTime(Number(match[1]), Number(match[2]))
                ? null
                : error('time', 'Enter a valid time')
        },
        AGE: (value) =>
            isDate(value) ? null : error('age', 'Enter a valid date'),
        COORDINATE: (value) => {
            const match = COORDINATE.exec(value)
            if (match === null) {
                return error('coordinate', 'Enter a valid coordinate')
            }
            const longitude = Number(match[1])
            const latitude = Number(match[2])
            return Math.abs(longitude) <= 180 && Math.abs(latitude) <= 90
                ? null
                : error('coordinate', 'Enter a valid coordinate')
        },
        ORGANISATION_UNIT: (value) =>
            UID.test(value)
                ? null
                : error('orgUnit', 'Select a valid organisation unit'),
        BOOLEAN: (value) =>
            value === 'true' || value === 'false'
                ? null
                : error('boolean', 'Select Yes or No'),
        TRUE_ONLY: (value) =>
            value === 'true'
                ? null
                : error('trueOnly', 'Only Yes can be selected'),
    } satisfies Record<string, Validator>)
)

const KINDS = new Map(
    Object.entries({
        TEXT: 'text',
        LONG_TEXT: 'longText',
        LETTER: 'text',
        EMAIL: 'text',
        PHONE_NUMBER: 'text',
        URL: 'text',
        INTEGER: 'number',
        INTEGER_POSITIVE: 'number',
        INTEGER_NEGATIVE: 'number',
        INTEGER_ZERO_OR_POSITIVE: 'number',
        NUMBER: 'number',
        PERCENTAGE: 'number',
        UNIT_INTERVAL: 'number',
        BOOLEAN: 'choice',
        TRUE_ONLY: 'trueOnly',
        DATE: 'date',
        DATETIME: 'dateTime',
        TIME: 'time',
        AGE: 'age',
        COORDINATE: 'coordinate',
        ORGANISATION_UNIT: 'orgUnit',
        // Handled below: a multi-select needs an option set.
        MULTI_TEXT: 'multiSelect',
    } satisfies Record<string, WidgetKind>)
)

const INPUT_MODES = new Map(
    Object.entries({
        TEXT: 'text',
        LONG_TEXT: 'text',
        LETTER: 'text',
        EMAIL: 'email',
        PHONE_NUMBER: 'tel',
        URL: 'url',
        INTEGER: 'numeric',
        INTEGER_POSITIVE: 'numeric',
        INTEGER_NEGATIVE: 'numeric',
        INTEGER_ZERO_OR_POSITIVE: 'numeric',
        NUMBER: 'decimal',
        PERCENTAGE: 'decimal',
        UNIT_INTERVAL: 'decimal',
    } satisfies Record<string, InputMode>)
)

/*
 * A data element's field mask is a TextPattern TEXT segment: \d digit, \x lower case letter,
 * \X capital letter, \w letter or digit, everything else as a regular expression. The mask must
 * match the whole value. Ported from Capture's fieldMask.ts; DHIS2 core validates this way too.
 */
const MASK_TOKENS = new Map(
    Object.entries({
        d: '[0-9]',
        x: '[a-z]',
        X: '[A-Z]',
        w: '[0-9a-zA-Z]',
    } satisfies Record<string, string>)
)

// Value types typed into a text box; the rest are picked with inputs that produce their own format.
const MASKABLE_VALUE_TYPES = new Set([
    'TEXT',
    'LONG_TEXT',
    'LETTER',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
    'UNIT_INTERVAL',
])

const maskCache = new Map<string, RegExp | null>()

const toMaskRegExp = (rawMask: string): RegExp | null => {
    const cached = maskCache.get(rawMask)
    if (cached !== undefined) {
        return cached
    }
    // Android accepts masks wrapped in single quotes.
    const mask =
        rawMask.length > 1 && rawMask.startsWith("'") && rawMask.endsWith("'")
            ? rawMask.slice(1, -1)
            : rawMask
    let source = ''
    for (let index = 0; index < mask.length; index += 1) {
        const char = mask[index]
        const next = mask[index + 1]
        if (char === '\\' && next !== undefined) {
            source += MASK_TOKENS.get(next) ?? `\\${next}`
            index += 1
        } else {
            source += char
        }
    }
    let regex: RegExp | null
    try {
        regex = new RegExp(`^(?:${source})$`)
    } catch {
        // A mask that is not a valid pattern is a configuration error; it must not block entry.
        regex = null
    }
    maskCache.set(rawMask, regex)
    return regex
}

const applicableFieldMask = (meta: DataElementMeta): string | undefined =>
    meta.fieldMask &&
    meta.options === undefined &&
    MASKABLE_VALUE_TYPES.has(meta.valueType)
        ? meta.fieldMask
        : undefined

const kindOf = (meta: DataElementMeta): WidgetKind => {
    const base: WidgetKind = KINDS.get(meta.valueType) ?? 'unsupported'
    if (base === 'unsupported') {
        return base
    }
    if (meta.valueType === 'MULTI_TEXT') {
        return meta.options === undefined || meta.options.length === 0
            ? 'unsupported'
            : 'multiSelect'
    }
    if (meta.valueType === 'BOOLEAN' || meta.options === undefined) {
        return base
    }
    // An option set without options leaves nothing to pick, and free text would be rejected.
    if (meta.options.length === 0) {
        return 'unsupported'
    }
    return meta.options.length > MAX_INLINE_CHOICES ? 'select' : 'choice'
}

export const getValueTypeSpec = (meta: DataElementMeta): ValueTypeSpec => {
    const kind = kindOf(meta)
    const mask = applicableFieldMask(meta)
    const typeValidator = VALIDATORS.get(meta.valueType)
    const inputMode =
        kind === 'text' || kind === 'longText' || kind === 'number'
            ? INPUT_MODES.get(meta.valueType)
            : undefined
    return {
        kind,
        ...(inputMode !== undefined && { inputMode }),
        validate: (value) => {
            // Whether a value is required is the form's concern, not the type's.
            if (value === '') {
                return null
            }
            const typeError = typeValidator?.(value) ?? null
            if (typeError !== null) {
                return typeError
            }
            if (mask !== undefined) {
                const regex = toMaskRegExp(mask)
                if (regex !== null && !regex.test(value)) {
                    return error(
                        'fieldMask',
                        'Enter a value in the required format'
                    )
                }
            }
            return null
        },
    }
}

export const answerChoices = (meta: DataElementMeta): AnswerChoice[] => {
    if (meta.valueType === 'BOOLEAN') {
        return [
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
        ]
    }
    return (meta.options ?? []).map((option) => ({
        value: option.code,
        label: option.label,
    }))
}

/**
 * Why a data element has no widget: its value type is not handled here, or its value type is
 * (a multi-select, or an option set) but no options are available to pick from.
 */
export const unsupportedReason = (
    meta: DataElementMeta
): UnsupportedReason | undefined => {
    if (kindOf(meta) !== 'unsupported') {
        return undefined
    }
    return KINDS.has(meta.valueType) ? 'noOptions' : 'valueType'
}

export const isSupportedValueType = (meta: DataElementMeta): boolean =>
    kindOf(meta) !== 'unsupported'
