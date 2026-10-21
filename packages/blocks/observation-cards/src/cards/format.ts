import i18n from '@dhis2/d2-i18n'
import {
    toInstant,
    type ObservationLegend,
    type ObservationOption,
    type ObservationPoint,
    type ObservationSeries,
} from '../use-tracked-entity-observations'

const TREND_TYPES = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
])

const LATEST_ONLY_TYPES = new Set([
    'BOOLEAN',
    'TRUE_ONLY',
    'TEXT',
    'LONG_TEXT',
    'DATE',
])

/** React escapes text itself, so i18next must not escape interpolated values a second time. */
export const NO_ESCAPE = { escapeValue: false }

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Types whose readings can be plotted and compared. */
export const isTrendType = (valueType: string): boolean =>
    TREND_TYPES.has(valueType)

/** Types the "last recorded" card can show; an option set supports any type. */
export const isSupportedLatestType = (
    valueType: string,
    hasOptionSet: boolean
): boolean =>
    hasOptionSet ||
    TREND_TYPES.has(valueType) ||
    LATEST_ONLY_TYPES.has(valueType)

/** The legend holding `value`. A start is inclusive and an end exclusive. */
export const legendFor = (
    legends: ObservationLegend[] | undefined,
    value: number
): ObservationLegend | undefined =>
    legends?.find(
        (legend) => value >= legend.startValue && value < legend.endValue
    )

/** The option for `code`; a code missing from the option set shows as itself, uncoloured. */
export const optionFor = (
    options: ObservationOption[] | undefined,
    code: string
): ObservationOption =>
    options?.find((option) => option.code === code) ?? { code, name: code }

const numberFormat = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
})

/** Formats for the user's locale with at most 2 decimals and no trailing zeros. */
export const formatNumber = (value: number): string => {
    const rounded = Math.round(value * 100) / 100
    // `=== 0` is also true for -0, which would otherwise print as "-0".
    return numberFormat.format(rounded === 0 ? 0 : rounded)
}

const datePart = (iso: string): string => iso.slice(0, 10)

/**
 * The text to show for a point: the option name, Yes or No, a rounded number, a
 * formatted date, or the raw value. `formatDate` defaults to the ISO date part.
 */
export const displayValue = (
    series: ObservationSeries,
    point: ObservationPoint,
    formatDate: (iso: string) => string = datePart
): string => {
    if (series.options) {
        return optionFor(series.options, point.value).name
    }
    switch (series.valueType) {
        case 'BOOLEAN':
        case 'TRUE_ONLY':
            return point.value === 'true' ? i18n.t('Yes') : i18n.t('No')
        case 'DATE':
            return formatDate(point.value)
        default:
            return point.numericValue === undefined
                ? point.value
                : formatNumber(point.numericValue)
    }
}

/** Whether the point is older than `staleAfterDays` at `now`. Never, without a threshold. */
export const isStale = (
    point: ObservationPoint,
    staleAfterDays: number | undefined,
    now: Date
): boolean => {
    if (staleAfterDays === undefined) {
        return false
    }
    const occurred = toInstant(point.occurredAt)
    return (
        Number.isFinite(occurred) &&
        (now.getTime() - occurred) / MS_PER_DAY > staleAfterDays
    )
}

const DAYS_PER_MONTH = 30.4375
const DAYS_PER_YEAR = 365.25

/**
 * How long before `now` the point was recorded, in the user's locale: "today",
 * "3 days ago", "5 months ago", "3 years ago". A future date reads "in 2 days".
 * Calendar-neutral, so it suits every DHIS2 calendar.
 */
export const relativeTime = (
    point: ObservationPoint,
    now: Date,
    locale: string | undefined
): string => {
    const occurred = toInstant(point.occurredAt)
    if (!Number.isFinite(occurred)) {
        return point.occurredAt
    }
    const days = Math.trunc((now.getTime() - occurred) / MS_PER_DAY)
    if (days === 0) {
        return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
            0,
            'day'
        )
    }
    const format = new Intl.RelativeTimeFormat(locale, { numeric: 'always' })
    const size = Math.abs(days)
    // Negative: the reading lies in the past.
    const sign = days > 0 ? -1 : 1
    if (size < 30) {
        return format.format(sign * size, 'day')
    }
    if (size < DAYS_PER_YEAR) {
        return format.format(
            sign * Math.max(1, Math.trunc(size / DAYS_PER_MONTH)),
            'month'
        )
    }
    return format.format(sign * Math.trunc(size / DAYS_PER_YEAR), 'year')
}

const BARE_HEX = /^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

/**
 * DHIS2 colours can arrive without a leading `#`. Prefixes bare hex, passes any
 * other CSS colour through and gives undefined for an empty one.
 */
export const normaliseColor = (
    color: string | undefined
): string | undefined => {
    const trimmed = color?.trim()
    if (!trimmed) {
        return undefined
    }
    return BARE_HEX.test(trimmed) ? `#${trimmed}` : trimmed
}

/** Luminance above which black text contrasts better than white (WCAG). */
const DARK_TEXT_LUMINANCE = 0.179

const linearChannel = (channel: number): number => {
    const scaled = channel / 255
    return scaled <= 0.04045
        ? scaled / 12.92
        : ((scaled + 0.055) / 1.055) ** 2.4
}

/**
 * Black or white, whichever reads better on a hex background. Undefined for a
 * colour that is not hex, which the caller cannot judge either.
 */
export const readableTextColor = (color: string): string | undefined => {
    const hex = normaliseColor(color)?.replace(/^#/, '')
    if (hex === undefined || !BARE_HEX.test(hex)) {
        return undefined
    }
    const full =
        hex.length === 3
            ? [...hex].map((digit) => digit + digit).join('')
            : hex.slice(0, 6)
    const [red = 0, green = 0, blue = 0] = [0, 2, 4].map((start) =>
        linearChannel(parseInt(full.slice(start, start + 2), 16))
    )
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
    return luminance > DARK_TEXT_LUMINANCE ? '#000000' : '#ffffff'
}
