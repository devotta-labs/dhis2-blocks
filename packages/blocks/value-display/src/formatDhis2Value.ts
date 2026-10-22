import i18n from '@dhis2/d2-i18n'
import { formatCalendarDate, storedDay, storedTime } from './calendar'
import type { FormatOptions, ValueMeta } from './types'

// Bundlers replace `process.env.NODE_ENV` statically. Declared here so a consumer
// without @types/node still type-checks this installed file.
declare const process: { env: { NODE_ENV?: string } }

const warned = new Set<string>()

const warnOnce = (valueType: string) => {
    if (process.env.NODE_ENV === 'production' || warned.has(valueType)) {
        return
    }
    warned.add(valueType)
    console.warn(
        `formatDhis2Value: unknown value type "${valueType}", showing the raw value`
    )
}

const formatNumber = (value: string, locale?: string): string => {
    const number = Number(value)
    return value.trim() === '' || Number.isNaN(number)
        ? value
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 20 }).format(
              number
          )
}

const formatCoordinate = (value: string): string => {
    try {
        const parsed: unknown = JSON.parse(value)
        if (
            Array.isArray(parsed) &&
            parsed.length >= 2 &&
            Number.isFinite(parsed[0]) &&
            Number.isFinite(parsed[1])
        ) {
            // Stored as [lng,lat], read as "lat, lng".
            return `${parsed[1]}, ${parsed[0]}`
        }
    } catch {
        // fall through to the raw value
    }
    return value
}

const formatDateTime = (value: string, { calendar, locale }: FormatOptions) => {
    const day = storedDay(value)
    if (day === undefined) {
        return value
    }
    const date = formatCalendarDate(day, calendar, locale)
    const time = storedTime(value)
    return time === undefined ? date : `${date} ${time}`
}

const optionName = (code: string, meta: ValueMeta): string =>
    meta.optionSet?.options.find((option) => option.code === code)
        ?.displayName ?? code

/**
 * A DHIS2 value as read-only text: option names for option sets, otherwise by
 * value type. Dates keep the day they were stored on. Nothing here throws; a
 * value it cannot read is returned as stored.
 */
export const formatDhis2Value = (
    value: string | null | undefined,
    meta: ValueMeta,
    options: FormatOptions
): string => {
    if (value === null || value === undefined || value === '') {
        return ''
    }
    const { calendar, locale, orgUnitNames } = options

    if (meta.optionSet !== undefined) {
        return meta.valueType === 'MULTI_TEXT'
            ? value
                  .split(',')
                  .map((code) => optionName(code, meta))
                  .join(', ')
            : optionName(value, meta)
    }

    switch (meta.valueType) {
        case 'TEXT':
        case 'LONG_TEXT':
        case 'TIME':
            return value
        case 'MULTI_TEXT':
            return value.split(',').join(', ')
        case 'INTEGER':
        case 'INTEGER_POSITIVE':
        case 'INTEGER_NEGATIVE':
        case 'INTEGER_ZERO_OR_POSITIVE':
        case 'NUMBER':
        case 'UNIT_INTERVAL':
            return formatNumber(value, locale)
        case 'PERCENTAGE':
            return `${formatNumber(value, locale)}%`
        case 'BOOLEAN':
        case 'TRUE_ONLY':
            return value === 'true' ? i18n.t('Yes') : i18n.t('No')
        case 'DATE':
        case 'AGE':
            return formatCalendarDate(value, calendar, locale)
        case 'DATETIME':
            return formatDateTime(value, options)
        case 'COORDINATE':
            return formatCoordinate(value)
        case 'ORGANISATION_UNIT':
            return orgUnitNames?.get(value) ?? value
        default:
            warnOnce(meta.valueType)
            return value
    }
}
