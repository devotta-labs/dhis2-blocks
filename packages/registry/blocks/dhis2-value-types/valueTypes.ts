import i18n from '@dhis2/d2-i18n'
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

const problem: (code: string, message: string) => ValueProblem = (
    code,
    message
) => ({
    code,
    message,
})

type Check = (value: string) => ValueProblem | undefined

const notAnOption = () => problem('option', i18n.t('Choose one of the options'))
const notANumber = () => problem('number', i18n.t('Enter a number'))
const decimalComma = () =>
    problem('decimalComma', i18n.t('Use a full stop for decimals'))
const notADate = () => problem('date', i18n.t('Enter a valid date'))
const notADateTime = () =>
    problem('dateTime', i18n.t('Enter a valid date and time'))
const outOfIntegerRange = () =>
    problem(
        'integerRange',
        i18n.t('Enter a whole number between -2147483648 and 2147483647')
    )
const notInMask = () =>
    problem('fieldMask', i18n.t('Enter a value in the required format'))

const STORED_INTEGER = /^(?:0|-?[1-9]\d*)$/
const STORED_INTEGER_POSITIVE = /^[1-9]\d*$/
const STORED_INTEGER_NEGATIVE = /^-[1-9]\d*$/
const STORED_INTEGER_ZERO_OR_POSITIVE = /^(?:0|[1-9]\d*)$/
const STORED_NUMBER = /^(?:-?0|-?[1-9]\d*)(?:\.\d+)?$/
const TYPED_NUMBER = /^(?<sign>-?)(?<whole>\d*)(?:\.(?<fraction>\d*))?$/
const DATE_TIME =
    /^(?<day>\d{4}-\d{2}-\d{2})T(?<hours>\d{2}):(?<minutes>\d{2})(?::(?<seconds>\d{2})(?:\.\d{1,3})?)?(?:Z|[+-](?<offsetHours>\d{2}):?(?<offsetMinutes>\d{2}))?$/
const TIME = /^(?<hours>\d{2}):(?<minutes>\d{2})$/
const COORDINATE = /^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/
const EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/
const PHONE = /^[\d\s+()#./ext-]{6,50}$/
const UID = /^[A-Za-z][A-Za-z0-9]{10}$/
const URL_PROTOCOLS = new Set(['http:', 'https:', 'ftp:'])

const isClockTime = (hours: string, minutes: string, seconds = '0') =>
    Number(hours) <= 23 && Number(minutes) <= 59 && Number(seconds) <= 59

const isNumber = (text: string) =>
    STORED_NUMBER.test(text) && Number.isFinite(Number(text))

const canonicalNumber = (text: string) => {
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

const COORDINATE_LIMITS = { latitude: 90, longitude: 180 }

/**
 * A typed latitude or longitude in the form numbers are stored in (`.5` is `0.5`, `5.` is `5`), or `undefined` when
 * it is not a number, as in a number cell, or lies outside its limit: 90 degrees for a latitude, 180 for a longitude.
 */
export const coordinateNumber = (
    axis: keyof typeof COORDINATE_LIMITS,
    text: string
) => {
    const number = canonicalNumber(text.trim())
    return number !== undefined &&
        Math.abs(Number(number)) <= COORDINATE_LIMITS[axis]
        ? number
        : undefined
}

const INTEGER_MIN = -2147483648
const INTEGER_MAX = 2147483647

const whole: (pattern: RegExp, bad: () => ValueProblem) => Check =
    (pattern, bad) => (value) => {
        if (!pattern.test(value)) {
            return bad()
        }
        const number = Number(value)
        return number >= INTEGER_MIN && number <= INTEGER_MAX
            ? undefined
            : outOfIntegerRange()
    }

const decimal: (
    accepts: (n: number) => boolean,
    bad: () => ValueProblem
) => Check = (accepts, bad) => (value) => {
    if (isNumber(value)) {
        return accepts(Number(value)) ? undefined : bad()
    }
    return value.includes(',') &&
        canonicalNumber(value.replace(',', '.')) !== undefined
        ? decimalComma()
        : bad()
}

const matches: (pattern: RegExp, bad: () => ValueProblem) => Check =
    (pattern, bad) => (value) =>
        pattern.test(value) ? undefined : bad()

const notACoordinate = () =>
    problem('coordinate', i18n.t('Enter a valid coordinate'))

/** A stored `[lng,lat]` as its numbers, or `undefined` when it is not one or is past a limit. */
export const parseCoordinate = (value: string) => {
    const match = COORDINATE.exec(value)
    return match !== null &&
        Math.abs(Number(match[1])) <= COORDINATE_LIMITS.longitude &&
        Math.abs(Number(match[2])) <= COORDINATE_LIMITS.latitude
        ? { longitude: match[1], latitude: match[2] }
        : undefined
}

const CHECKS = new Map(
    Object.entries({
        INTEGER: whole(STORED_INTEGER, () =>
            problem('integer', i18n.t('Enter a whole number'))
        ),
        INTEGER_POSITIVE: whole(STORED_INTEGER_POSITIVE, () =>
            problem(
                'integerPositive',
                i18n.t('Enter a whole number greater than zero')
            )
        ),
        INTEGER_NEGATIVE: whole(STORED_INTEGER_NEGATIVE, () =>
            problem(
                'integerNegative',
                i18n.t('Enter a whole number less than zero')
            )
        ),
        INTEGER_ZERO_OR_POSITIVE: whole(STORED_INTEGER_ZERO_OR_POSITIVE, () =>
            problem(
                'integerZeroOrPositive',
                i18n.t('Enter a whole number of zero or more')
            )
        ),
        NUMBER: decimal(() => true, notANumber),
        PERCENTAGE: decimal(
            (n) => n >= 0 && n <= 100,
            () =>
                problem(
                    'percentage',
                    i18n.t('Enter a percentage between 0 and 100')
                )
        ),
        UNIT_INTERVAL: decimal(
            (n) => n >= 0 && n <= 1,
            () =>
                problem(
                    'unitInterval',
                    i18n.t('Enter a number between 0 and 1')
                )
        ),
        LETTER: matches(/^\p{L}$/u, () =>
            problem('letter', i18n.t('Enter a single letter'))
        ),
        EMAIL: matches(EMAIL, () =>
            problem('email', i18n.t('Enter a valid email address'))
        ),
        PHONE_NUMBER: matches(PHONE, () =>
            problem('phoneNumber', i18n.t('Enter a valid phone number'))
        ),
        URL: (value) => {
            try {
                if (URL_PROTOCOLS.has(new URL(value).protocol)) {
                    return undefined
                }
            } catch {}
            return problem('url', i18n.t('Enter a valid URL'))
        },
        DATE: (value) => (isIsoDate(value) ? undefined : notADate()),
        DATETIME: (value) => {
            const groups = DATE_TIME.exec(value)?.groups
            return groups !== undefined &&
                isIsoDate(groups.day) &&
                isClockTime(groups.hours, groups.minutes, groups.seconds) &&
                isClockTime(
                    groups.offsetHours ?? '0',
                    groups.offsetMinutes ?? '0'
                )
                ? undefined
                : notADateTime()
        },
        TIME: (value) => {
            const groups = TIME.exec(value)?.groups
            return groups !== undefined &&
                isClockTime(groups.hours, groups.minutes)
                ? undefined
                : problem('time', i18n.t('Enter a valid time'))
        },
        AGE: (value) => (isIsoDate(value) ? undefined : notADate()),
        COORDINATE: (value) =>
            parseCoordinate(value) ? undefined : notACoordinate(),
        ORGANISATION_UNIT: matches(UID, () =>
            problem('orgUnit', i18n.t('Select a valid organisation unit'))
        ),
        BOOLEAN: (value) =>
            value === 'true' || value === 'false'
                ? undefined
                : problem('boolean', i18n.t('Select Yes or No')),
        TRUE_ONLY: (value) =>
            value === 'true'
                ? undefined
                : problem('trueOnly', i18n.t('Only Yes can be selected')),
    } satisfies Record<string, Check>)
)

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
        ORGANISATION_UNIT: 'search',
        USERNAME: 'search',
        FILE_RESOURCE: 'popup',
        IMAGE: 'popup',
    } satisfies Record<string, CellKind>)
)

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

export const cellKind: (field: Field) => CellKind = ({
    valueType,
    options,
}) => {
    const kind = KINDS.get(valueType) ?? 'readOnly'
    return options !== undefined &&
        kind !== 'popup' &&
        kind !== 'search' &&
        kind !== 'readOnly'
        ? 'option'
        : kind
}

const LEFT_TO_RIGHT: ReadonlySet<string> = new Set([
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'NUMBER',
    'PERCENTAGE',
    'UNIT_INTERVAL',
    'DATE',
    'DATETIME',
    'TIME',
    'AGE',
    'PHONE_NUMBER',
    'EMAIL',
    'URL',
    'COORDINATE',
])

/**
 * The `dir` for a field's text: `ltr` for a value that reads left to right in any script, so a right-to-left page
 * keeps `+232 76…` and `-3` in order; `auto` for words, such as free text and option names, which follow their script.
 */
export const textDirectionFor: (field: Field) => 'ltr' | 'auto' = ({
    valueType,
    options,
}) => (options === undefined && LEFT_TO_RIGHT.has(valueType) ? 'ltr' : 'auto')

export const inputModeFor: (field: Field) => InputMode | undefined = (
    field
) => {
    const kind = cellKind(field)
    return kind === 'text' || kind === 'number'
        ? INPUT_MODES.get(field.valueType)
        : undefined
}

interface OptionLookup {
    texts: ReadonlyMap<string, string>
    resolve: (text: string) => string
}

const lookups = new WeakMap<ReadonlyArray<Option>, OptionLookup>()

const lookupOf = (options: ReadonlyArray<Option>) => {
    const known = lookups.get(options)
    if (known !== undefined) {
        return known
    }
    const texts = new Map(options.map(({ code }) => [code, code]))
    const codeOf = new Map<string, string>()
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
    for (const { code, name } of options) {
        texts.set(code, resolve(name.trim()) === code ? name.trim() : code)
    }
    const lookup = { texts, resolve }
    lookups.set(options, lookup)
    return lookup
}

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
) => {
    if (options !== undefined) {
        const { texts } = lookupOf(options)
        const codes = valueType === 'MULTI_TEXT' ? value.split(',') : [value]
        return codes.every((code) => texts.has(code))
            ? undefined
            : notAnOption()
    }
    const typeProblem = CHECKS.get(valueType)?.(value)
    if (typeProblem !== undefined || fieldMask === undefined) {
        return typeProblem
    }
    return MASKABLE_VALUE_TYPES.has(valueType) &&
        !matchesFieldMask(fieldMask, value)
        ? notInMask()
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

const yesNo = () =>
    new Map([
        ['true', i18n.t('Yes')],
        ['false', i18n.t('No')],
    ])

const languageTags = () => {
    try {
        return Intl.getCanonicalLocales(i18n.language?.replace(/_/g, '-'))
    } catch {
        return []
    }
}

const booleanOf = (text: string) => {
    const tags = languageTags()
    const word = text.toLocaleLowerCase(tags)
    const labelled = [...yesNo()].find(
        ([, label]) => label.toLocaleLowerCase(tags) === word
    )
    return labelled?.[0] ?? BOOLEAN_WORDS.get(text.toLowerCase())
}

const DATE_TIME_TEXT = /^(?<day>\S+?)(?:\s+|T)(?<time>\d{1,2}:\d{2})$/

const paddedTime = (text: string) =>
    /^\d:\d{2}$/.test(text) ? `0${text}` : text

const dateTimeToStored = (text: string, settings: ValueSettings) => {
    const groups = DATE_TIME_TEXT.exec(text)?.groups
    if (groups === undefined) {
        return undefined
    }
    const day = calendarDateToIso(groups.day, settings)
    return day === undefined ? undefined : `${day}T${paddedTime(groups.time)}`
}

const coordinateToStored = (text: string) => {
    const bracketed = text.startsWith('[') && text.endsWith(']')
    const parts = (bracketed ? text.slice(1, -1) : text).split(',')
    if (parts.length !== 2) {
        return text
    }
    const [first, second] = parts
    const longitude = coordinateNumber('longitude', bracketed ? first : second)
    const latitude = coordinateNumber('latitude', bracketed ? second : first)
    return longitude === undefined || latitude === undefined
        ? text
        : `[${longitude},${latitude}]`
}

const toStored = (
    field: Field,
    kind: CellKind,
    text: string,
    settings: ValueSettings
) => {
    const { options } = field
    if (options !== undefined && field.valueType === 'MULTI_TEXT') {
        const codes = text
            .split(',')
            .map((part) => lookupOf(options).resolve(part.trim()))
        return [...new Set(codes)].join(',')
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
            return booleanOf(text) ?? text
        case 'date':
            return calendarDateToIso(text, settings)
        case 'dateTime':
            return dateTimeToStored(text, settings)
        case 'popup':
            return field.valueType === 'COORDINATE'
                ? coordinateToStored(text)
                : text
        default:
            return text
    }
}

const textKind = (field: Field) =>
    field.valueType === 'AGE' ? 'date' : cellKind(field)

/** What a person typed or pasted → the stored value (`undefined` = no value), or a problem. */
export const parseTyped: (
    field: Field,
    text: string,
    settings: ValueSettings
) => TypedValue = (field, text, settings) => {
    const trimmed = text.trim()
    if (trimmed === '') {
        return { ok: true, value: undefined }
    }
    const kind = textKind(field)
    const stored = toStored(field, kind, trimmed, settings)
    if (kind === 'trueOnly' && stored === 'false') {
        return { ok: true, value: undefined }
    }
    if (stored === undefined) {
        return {
            ok: false,
            problem: kind === 'dateTime' ? notADateTime() : notADate(),
        }
    }
    const bad = checkStored(field, stored)
    return bad === undefined
        ? { ok: true, value: stored }
        : { ok: false, problem: bad }
}

/** A stored value → the text an editable cell shows (what the person would type). */
export const typedText: (
    field: Field,
    value: string,
    settings: ValueSettings
) => string = (field, value, settings) => {
    switch (textKind(field)) {
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
            return yesNo().get(value) ?? value
        case 'option':
            return (
                (field.options && lookupOf(field.options).texts.get(value)) ??
                value
            )
        default:
            return value
    }
}
