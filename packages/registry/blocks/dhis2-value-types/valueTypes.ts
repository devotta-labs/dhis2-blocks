import { storedDay, storedTime } from '@/components/dhis2-value-display'
import { calendarDateToIso, isIsoDate, isoToCalendarDate } from './dates'
import { matchesFieldMask } from './fieldMask'
import type {
    CellKind,
    Field,
    InputMode,
    Option,
    TypedValue,
    ValueProblem,
    ValueSettings,
} from './types'

const problem = (code: string, message: string): ValueProblem => ({
    code,
    message,
})

type Check = (value: string) => ValueProblem | undefined

const NOT_AN_OPTION = problem('option', 'Choose one of the options')
const NOT_A_NUMBER = problem('number', 'Enter a number')
const DECIMAL_COMMA = problem('decimalComma', 'Use a full stop for decimals')
const NOT_A_DATE = problem('date', 'Enter a valid date')
const NOT_A_DATE_TIME = problem('dateTime', 'Enter a valid date and time')
const NOT_IN_MASK = problem('fieldMask', 'Enter a value in the required format')

// What DHIS2's server accepts for numbers: no leading zeros, no exponent.
const STORED_INTEGER = /^(?:0|-?[1-9]\d*)$/
const STORED_INTEGER_POSITIVE = /^[1-9]\d*$/
const STORED_INTEGER_NEGATIVE = /^-[1-9]\d*$/
const STORED_INTEGER_ZERO_OR_POSITIVE = /^(?:0|[1-9]\d*)$/
const STORED_NUMBER = /^(?:-?0|-?[1-9]\d*)(?:\.\d+)?$/
// A number as a person types it: `.5`, `5.` and `007` are all read.
const TYPED_NUMBER = /^(?<sign>-?)(?<whole>\d*)(?:\.(?<fraction>\d*))?$/
// The server may add a UTC or offset suffix to the time.
const DATE_TIME =
    /^(?<day>\d{4}-\d{2}-\d{2})T(?<hours>\d{2}):(?<minutes>\d{2})(?::(?<seconds>\d{2})(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})?$/
const TIME = /^(?<hours>\d{2}):(?<minutes>\d{2})$/
const COORDINATE = /^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
// The server's own character set, which allows extensions such as "555 ext 12".
const PHONE = /^[\d\s+()#./ext-]{1,50}$/
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/
const URL_PROTOCOLS = new Set(['http:', 'https:', 'ftp:'])

const isClockTime = (hours: string, minutes: string, seconds = '0') =>
    Number(hours) <= 23 && Number(minutes) <= 59 && Number(seconds) <= 59

const isNumber = (text: string) =>
    STORED_NUMBER.test(text) && Number.isFinite(Number(text))

/**
 * A typed number in the form DHIS2 stores: no leading zeros, `-0` as `0`, a
 * digit before the point and none after a bare one. The fraction's digits stay
 * as typed. Text that is not a plain number comes back as `undefined`.
 */
const canonicalNumber = (text: string): string | undefined => {
    const groups = TYPED_NUMBER.exec(text)?.groups
    if (groups === undefined || !/\d/.test(text)) {
        return undefined
    }
    const integerPart = groups.whole.replace(/^0+/, '') || '0'
    const digits = groups.fraction
        ? `${integerPart}.${groups.fraction}`
        : integerPart
    return /[1-9]/.test(digits) ? `${groups.sign}${digits}` : digits
}

const whole =
    (pattern: RegExp, bad: ValueProblem): Check =>
    (value) =>
        pattern.test(value) && Number.isSafeInteger(Number(value))
            ? undefined
            : bad

const decimal =
    (accepts: (n: number) => boolean, bad: ValueProblem): Check =>
    (value) => {
        if (isNumber(value)) {
            return accepts(Number(value)) ? undefined : bad
        }
        return value.includes(',') &&
            canonicalNumber(value.replace(',', '.')) !== undefined
            ? DECIMAL_COMMA
            : bad
    }

const matches =
    (pattern: RegExp, bad: ValueProblem): Check =>
    (value) =>
        pattern.test(value) ? undefined : bad

const NOT_A_COORDINATE = problem('coordinate', 'Enter a valid coordinate')

// What each value type accepts in its stored form.
const CHECKS = new Map(
    Object.entries({
        INTEGER: whole(
            STORED_INTEGER,
            problem('integer', 'Enter a whole number')
        ),
        INTEGER_POSITIVE: whole(
            STORED_INTEGER_POSITIVE,
            problem('integerPositive', 'Enter a whole number greater than zero')
        ),
        INTEGER_NEGATIVE: whole(
            STORED_INTEGER_NEGATIVE,
            problem('integerNegative', 'Enter a whole number less than zero')
        ),
        INTEGER_ZERO_OR_POSITIVE: whole(
            STORED_INTEGER_ZERO_OR_POSITIVE,
            problem(
                'integerZeroOrPositive',
                'Enter a whole number of zero or more'
            )
        ),
        NUMBER: decimal(() => true, NOT_A_NUMBER),
        PERCENTAGE: decimal(
            (n) => n >= 0 && n <= 100,
            problem('percentage', 'Enter a percentage between 0 and 100')
        ),
        UNIT_INTERVAL: decimal(
            (n) => n >= 0 && n <= 1,
            problem('unitInterval', 'Enter a number between 0 and 1')
        ),
        LETTER: matches(/^\p{L}$/u, problem('letter', 'Enter a single letter')),
        EMAIL: matches(EMAIL, problem('email', 'Enter a valid email address')),
        PHONE_NUMBER: matches(
            PHONE,
            problem('phoneNumber', 'Enter a valid phone number')
        ),
        URL: (value) => {
            const bad = problem('url', 'Enter a valid URL')
            try {
                return URL_PROTOCOLS.has(new URL(value).protocol)
                    ? undefined
                    : bad
            } catch {
                return bad
            }
        },
        DATE: (value) => (isIsoDate(value) ? undefined : NOT_A_DATE),
        DATETIME: (value) => {
            const groups = DATE_TIME.exec(value)?.groups
            return groups !== undefined &&
                isIsoDate(groups.day) &&
                isClockTime(groups.hours, groups.minutes, groups.seconds)
                ? undefined
                : NOT_A_DATE_TIME
        },
        TIME: (value) => {
            const groups = TIME.exec(value)?.groups
            return groups !== undefined &&
                isClockTime(groups.hours, groups.minutes)
                ? undefined
                : problem('time', 'Enter a valid time')
        },
        AGE: (value) => (isIsoDate(value) ? undefined : NOT_A_DATE),
        COORDINATE: (value) => {
            const match = COORDINATE.exec(value)
            return match !== null &&
                Math.abs(Number(match[1])) <= 180 &&
                Math.abs(Number(match[2])) <= 90
                ? undefined
                : NOT_A_COORDINATE
        },
        ORGANISATION_UNIT: matches(
            UID,
            problem('orgUnit', 'Select a valid organisation unit')
        ),
        BOOLEAN: (value) =>
            value === 'true' || value === 'false'
                ? undefined
                : problem('boolean', 'Select Yes or No'),
        TRUE_ONLY: (value) =>
            value === 'true'
                ? undefined
                : problem('trueOnly', 'Only Yes can be selected'),
    } satisfies Record<string, Check>)
)

// A value type not listed is read-only: nothing here can say what it takes.
const KINDS = new Map(
    Object.entries({
        TEXT: 'text',
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
        DATE: 'date',
        DATETIME: 'dateTime',
        TIME: 'time',
        BOOLEAN: 'boolean',
        TRUE_ONLY: 'trueOnly',
        LONG_TEXT: 'popup',
        MULTI_TEXT: 'popup',
        AGE: 'popup',
        COORDINATE: 'popup',
        ORGANISATION_UNIT: 'popup',
        USERNAME: 'popup',
        FILE_RESOURCE: 'popup',
        IMAGE: 'popup',
    } satisfies Record<string, CellKind>)
)

// A value that can be negative has none: phone keypads for numeric and
// decimal input have no minus key.
const INPUT_MODES = new Map(
    Object.entries({
        TEXT: 'text',
        LETTER: 'text',
        EMAIL: 'email',
        PHONE_NUMBER: 'tel',
        URL: 'url',
        INTEGER_POSITIVE: 'numeric',
        INTEGER_ZERO_OR_POSITIVE: 'numeric',
        PERCENTAGE: 'decimal',
        UNIT_INTERVAL: 'decimal',
    } satisfies Record<string, InputMode>)
)

export const cellKind = ({ valueType, options }: Field): CellKind => {
    const kind = KINDS.get(valueType) ?? 'readOnly'
    return options !== undefined && kind !== 'popup' && kind !== 'readOnly'
        ? 'option'
        : kind
}

export const inputModeFor = (field: Field): InputMode | undefined => {
    const kind = cellKind(field)
    return kind === 'text' || kind === 'number'
        ? INPUT_MODES.get(field.valueType)
        : undefined
}

interface OptionLookup {
    /**
     * Each code with the text a person types for it: its name when that name
     * finds it again, else the code.
     */
    texts: ReadonlyMap<string, string>
    /** The code a typed code or name means, or the text itself when no option matches. */
    resolve: (text: string) => string
}

// An option set can hold thousands of options and every cell using it asks.
const lookups = new WeakMap<ReadonlyArray<Option>, OptionLookup>()

const lookupOf = (options: ReadonlyArray<Option>): OptionLookup => {
    const known = lookups.get(options)
    if (known !== undefined) {
        return known
    }
    const texts = new Map(options.map(({ code }) => [code, code]))
    const codeOf = new Map<string, string>()
    // Codes first, so a code wins over another option's name.
    for (const { code } of options) {
        codeOf.set(code.toLowerCase(), code)
    }
    for (const { code, name } of options) {
        const key = name.trim().toLowerCase()
        if (!codeOf.has(key)) {
            codeOf.set(key, code)
        }
    }
    const resolve = (text: string) =>
        texts.has(text) ? text : (codeOf.get(text.toLowerCase()) ?? text)
    // A duplicate name, or one that is another option's code, cannot be typed back.
    for (const { code, name } of options) {
        texts.set(code, resolve(name.trim()) === code ? name.trim() : code)
    }
    const lookup = { texts, resolve }
    lookups.set(options, lookup)
    return lookup
}

// Masks apply to what is typed into a text box, not to dates or pick lists.
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

/** A stored value that today's rules reject (legacy data), checked on load. */
export const checkStored = (
    { valueType, options, fieldMask }: Field,
    value: string
): ValueProblem | undefined => {
    if (options !== undefined) {
        const { texts } = lookupOf(options)
        const codes = valueType === 'MULTI_TEXT' ? value.split(',') : [value]
        return codes.every((code) => texts.has(code))
            ? undefined
            : NOT_AN_OPTION
    }
    const typeProblem = CHECKS.get(valueType)?.(value)
    if (typeProblem !== undefined || fieldMask === undefined) {
        return typeProblem
    }
    return MASKABLE_VALUE_TYPES.has(valueType) &&
        !matchesFieldMask(fieldMask, value)
        ? NOT_IN_MASK
        : undefined
}

const BOOLEAN_WORDS = new Map([
    ['yes', 'true'],
    ['true', 'true'],
    ['1', 'true'],
    ['x', 'true'],
    ['no', 'false'],
    ['false', 'false'],
    ['0', 'false'],
])

const DATE_TIME_TEXT = /^(?<day>\S+?)(?:\s+|T)(?<time>\d{1,2}:\d{2})$/

/** `9:30` as `09:30`; anything else as typed. */
const paddedTime = (text: string) =>
    /^\d:\d{2}$/.test(text) ? `0${text}` : text

const dateTimeToStored = (
    text: string,
    settings: ValueSettings
): string | undefined => {
    const groups = DATE_TIME_TEXT.exec(text)?.groups
    if (groups === undefined) {
        return undefined
    }
    const day = calendarDateToIso(groups.day, settings)
    return day === undefined ? undefined : `${day}T${paddedTime(groups.time)}`
}

/**
 * What a person typed or pasted as the stored text, or `undefined` for a date
 * the calendar does not have. Text that does not fit is returned as typed, for
 * `checkStored` to refuse.
 */
const toStored = (
    field: Field,
    kind: CellKind,
    text: string,
    settings: ValueSettings
): string | undefined => {
    const { options } = field
    if (options !== undefined && field.valueType === 'MULTI_TEXT') {
        return text
            .split(',')
            .map((part) => lookupOf(options).resolve(part.trim()))
            .join(',')
    }
    if (options !== undefined && kind === 'option') {
        return lookupOf(options).resolve(text)
    }
    switch (kind) {
        case 'number':
            return canonicalNumber(text) ?? text
        case 'time':
            return paddedTime(text)
        case 'boolean':
        case 'trueOnly':
            return BOOLEAN_WORDS.get(text.toLowerCase()) ?? text
        case 'date':
            return calendarDateToIso(text, settings)
        case 'dateTime':
            return dateTimeToStored(text, settings)
        default:
            return text
    }
}

/** What a person typed or pasted → the stored value (`undefined` = no value), or a problem. */
export const parseTyped = (
    field: Field,
    text: string,
    settings: ValueSettings
): TypedValue => {
    const trimmed = text.trim()
    if (trimmed === '') {
        return { ok: true, value: undefined }
    }
    const kind = cellKind(field)
    const stored = toStored(field, kind, trimmed, settings)
    // A yes-only field has no "no": the value is just absent.
    if (kind === 'trueOnly' && stored === 'false') {
        return { ok: true, value: undefined }
    }
    if (stored === undefined) {
        return {
            ok: false,
            problem: kind === 'dateTime' ? NOT_A_DATE_TIME : NOT_A_DATE,
        }
    }
    const bad = checkStored(field, stored)
    return bad === undefined
        ? { ok: true, value: stored }
        : { ok: false, problem: bad }
}

const YES_NO = new Map([
    ['true', 'Yes'],
    ['false', 'No'],
])

/** A stored value → the text an editable cell shows (what the person would type). */
export const typedText = (
    field: Field,
    value: string,
    settings: ValueSettings
): string => {
    switch (cellKind(field)) {
        case 'date':
            return isoToCalendarDate(storedDay(value) ?? value, settings)
        case 'dateTime': {
            const day = storedDay(value)
            const time = storedTime(value)
            return day === undefined || time === undefined
                ? value
                : `${isoToCalendarDate(day, settings)} ${time}`
        }
        case 'boolean':
        case 'trueOnly':
            return YES_NO.get(value) ?? value
        case 'option':
            return (
                (field.options && lookupOf(field.options).texts.get(value)) ??
                value
            )
        default:
            return value
    }
}
