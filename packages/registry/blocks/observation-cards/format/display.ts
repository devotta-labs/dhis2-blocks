import {
    formatCalendarDate,
    formatDhis2Value,
} from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import { isNumericValueType, toInstant } from '../api/buildSeries'
import type {
    DataElementMetadata,
    ObservationLegendBand,
    ObservationPoint,
    ObservationSeries,
} from '../api/types'

/** React escapes text itself, so i18next must not escape interpolated values a second time. */
export const NO_ESCAPE = { escapeValue: false }

export interface DisplayOptions {
    calendar: Dhis2Calendar
    locale?: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

const LATEST_ONLY_TYPES = new Set([
    'BOOLEAN',
    'TRUE_ONLY',
    'TEXT',
    'LONG_TEXT',
    'DATE',
])

/** Numeric readings plot and compare; option codes do not, even numeric ones. */
const trends = (hasOptions: boolean, valueType: string): boolean =>
    !hasOptions && isNumericValueType(valueType)

export const showsTrend = (series: ObservationSeries): boolean =>
    trends(series.options !== undefined, series.valueType)

/** showsTrend from metadata alone, before any reading has loaded. */
export const elementShowsTrend = (element: DataElementMetadata): boolean =>
    trends(element.optionSet !== undefined, element.valueType)

/** Types a card can show; an option set supports any type. */
export const isSupportedValueType = (series: ObservationSeries): boolean =>
    series.options !== undefined ||
    isNumericValueType(series.valueType) ||
    LATEST_ONLY_TYPES.has(series.valueType)

/**
 * The legend holding `value`. A start is inclusive and an end exclusive, except
 * the end of the highest legend, so the top of the scale still has a legend.
 */
export const legendFor = (
    legends: ObservationLegendBand[] | undefined,
    value: number | undefined
): ObservationLegendBand | undefined => {
    if (value === undefined || legends === undefined || legends.length === 0) {
        return undefined
    }
    const holding = legends.find(
        (legend) => value >= legend.startValue && value < legend.endValue
    )
    if (holding !== undefined) {
        return holding
    }
    const highest = legends.reduce((top, legend) =>
        legend.endValue > top.endValue ? legend : top
    )
    return value === highest.endValue ? highest : undefined
}

/** A reading as shown: option names, Yes or No, dates in the system calendar. */
export const formatPointValue = (
    series: ObservationSeries,
    point: ObservationPoint,
    options: DisplayOptions
): string =>
    formatDhis2Value(
        point.value,
        {
            valueType: series.valueType,
            optionSet: series.options && {
                options: series.options.map(({ code, name }) => ({
                    code,
                    displayName: name,
                })),
            },
        },
        options
    )

/** The day a reading was recorded on, in the system calendar. */
export const formatRecordedDate = (
    point: ObservationPoint,
    { calendar, locale }: DisplayOptions
): string => formatCalendarDate(point.occurredAt, calendar, locale)

export interface ChangeLine {
    /** Shown as an arrow, and said as a word to screen readers. */
    direction?: 'up' | 'down'
    text: string
}

/** The change from the previous reading, or nothing when there is no earlier one. */
export const changeLine = (
    series: ObservationSeries,
    unit: string | undefined,
    options: DisplayOptions
): ChangeLine | undefined => {
    const { change, previous, latest, legends } = series
    if (change === undefined || previous === undefined) {
        return undefined
    }
    const date = formatRecordedDate(previous, options)
    const now = legendFor(legends, latest?.numericValue)
    const was = legendFor(legends, previous.numericValue)
    const move =
        now && was && now.name !== was.name
            ? i18n.t(', now {{legend}} (was {{previous}})', {
                  legend: now.name,
                  previous: was.name,
                  interpolation: NO_ESCAPE,
              })
            : ''
    if (change === 0) {
        return {
            text:
                i18n.t('No change since {{date}}', {
                    date,
                    interpolation: NO_ESCAPE,
                }) + move,
        }
    }
    // `change` is already at the readings' precision, and takes their type's form, so a PERCENTAGE keeps its "%".
    const size = formatDhis2Value(
        String(Math.abs(change)),
        { valueType: series.valueType },
        options
    )
    return {
        direction: change > 0 ? 'up' : 'down',
        text:
            i18n.t('{{change}} since {{date}}', {
                change: [size, unit].filter(Boolean).join(' '),
                date,
                interpolation: NO_ESCAPE,
            }) + move,
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

/** Days since 1970-01-01 of the `YYYY-MM-DD` the point was recorded on; NaN when it has none. */
const dayNumber = (iso: string): number =>
    Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) / MS_PER_DAY

/**
 * How long before `now` the point was recorded, in the user's locale: "today",
 * "3 days ago", "5 months ago", "3 years ago". A future date reads "in 2 days".
 * Counts calendar days between the date the reading was recorded on, as
 * written, and the user's local date, so last night's reading is "1 day ago".
 * Calendar-neutral, so it suits every DHIS2 calendar.
 */
export const relativeTime = (
    point: ObservationPoint,
    now: Date,
    locale: string | undefined
): string => {
    const occurred = dayNumber(point.occurredAt)
    if (!Number.isFinite(occurred)) {
        return point.occurredAt
    }
    const today =
        Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / MS_PER_DAY
    const days = Math.round(today - occurred)
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
    // Rounded, not truncated, so 59 days reads "2 months ago" and an old reading never looks newer.
    const months = Math.round(size / DAYS_PER_MONTH)
    if (months < 12) {
        return format.format(sign * months, 'month')
    }
    return format.format(sign * Math.round(size / DAYS_PER_YEAR), 'year')
}

/**
 * The user's DHIS2 locale as a tag `Intl` accepts. DHIS2 uses underscores
 * (`fr_SN`), which `Intl` rejects; one it still can't read falls back to the
 * browser's locale.
 */
export const displayLocale = (): string | undefined => {
    try {
        return Intl.getCanonicalLocales(i18n.language?.replace(/_/g, '-'))[0]
    } catch {
        return undefined
    }
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
