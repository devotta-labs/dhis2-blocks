import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { buildApiHref } from '../../api/requests'
import type { ProfileSystemInfo } from '../../api/schemas'
import type {
    ProfileFieldOption,
    ProfileFieldValue,
    ProfileValueType,
} from '../../types'
import type { FormattableValue, ValueFormatter } from './contracts'
import { formatServerDate, formatServerDateTime } from './dates'
import type { OrganisationUnitLookup } from './lookups'

/** Everything `formatValue` needs, resolved ahead of time. */
export interface FormatContext {
    systemInfo: ProfileSystemInfo
    /** From `useConfig()`; passed to `buildApiHref` for file and image hrefs. */
    api: { baseUrl: string; apiVersion: number }
    fileResourceNames: ReadonlyMap<string, string>
    organisationUnits: ReadonlyMap<string, OrganisationUnitLookup>
}

const EMPTY: ProfileFieldValue = { kind: 'empty' }

const text = (value: string): ProfileFieldValue => ({
    kind: 'text',
    text: value,
})

const NUMERIC_VALUE_TYPES: ReadonlySet<ProfileValueType> = new Set([
    'NUMBER',
    'INTEGER',
    'INTEGER_POSITIVE',
    'INTEGER_NEGATIVE',
    'INTEGER_ZERO_OR_POSITIVE',
    'PERCENTAGE',
])

/** Capture's `parseNumber`: spaces dropped, a decimal comma accepted. */
const parseNumber = (value: string): number | undefined => {
    const normalized = value.replace(/ /g, '').replace(',', '.')
    if (normalized === '') {
        return undefined
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
}

/**
 * Capture converts option codes and values to the field's client type before
 * comparing them, so `1` matches the code `1.0` on a NUMBER option set.
 */
const optionMatches = (
    option: ProfileFieldOption,
    value: string,
    valueType: ProfileValueType
) => {
    if (option.code === value) {
        return true
    }
    if (NUMERIC_VALUE_TYPES.has(valueType)) {
        const code = parseNumber(option.code)
        return code !== undefined && code === parseNumber(value)
    }
    return false
}

/** An unknown code shows as-is rather than blanking the row. */
const optionName = (
    options: readonly ProfileFieldOption[],
    value: string,
    valueType: ProfileValueType
) =>
    options.find((option) => optionMatches(option, value, valueType))
        ?.displayName ?? value

const formatOptionValue = (
    options: readonly ProfileFieldOption[],
    value: string,
    valueType: ProfileValueType
) =>
    valueType === 'MULTI_TEXT'
        ? value
              .split(',')
              .map((code) => code.trim())
              .filter((code) => code !== '')
              .map((code) => optionName(options, code, valueType))
              .join(', ')
        : optionName(options, value, valueType)

/** `[longitude, latitude]` as DHIS2 stores COORDINATE values. */
const parseCoordinate = (value: string): ProfileFieldValue | undefined => {
    const parts = value.replace(/[()[\]\s]/g, '').split(',')
    if (parts.length !== 2 || parts.some((part) => part === '')) {
        return undefined
    }
    const [longitude, latitude] = parts.map(Number)
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        ? { kind: 'coordinate', latitude, longitude }
        : undefined
}

const GeoJsonValueSchema = z.union([
    z
        .object({ type: z.enum(['Polygon', 'MultiPolygon']) })
        .transform((): ProfileFieldValue => ({ kind: 'polygon' })),
    z
        .object({
            type: z.literal('Point'),
            coordinates: z.tuple([z.number(), z.number()]).rest(z.number()),
        })
        .transform(
            ({ coordinates: [longitude, latitude] }): ProfileFieldValue => ({
                kind: 'coordinate',
                latitude,
                longitude,
            })
        ),
])

/**
 * GEOJSON has no Capture converter. Polygons show as the "Polygon" literal
 * Capture uses for geometry, points as coordinates, anything else as text.
 */
const parseGeoJson = (value: string): ProfileFieldValue | undefined => {
    try {
        const parsed = GeoJsonValueSchema.safeParse(JSON.parse(value))
        return parsed.success ? parsed.data : undefined
    } catch {
        return undefined
    }
}

const formatFile = (
    value: FormattableValue & { rawValue: string },
    context: FormatContext
): ProfileFieldValue => {
    const name = context.fileResourceNames.get(value.rawValue)
    if (!value.file) {
        return text(name ?? value.rawValue)
    }
    // A file resource that is gone or not visible (403/404) has no name in the
    // lookup and blanks only its own row. A nameless one does too, since a link
    // needs a name. Other lookup failures surface as a formatter error.
    if (!name) {
        return EMPTY
    }
    return {
        kind: 'file',
        name,
        href: buildApiHref(
            context.api,
            `${value.file.endpoint}/file`,
            value.file.params
        ),
    }
}

const formatImage = (
    value: FormattableValue & { rawValue: string },
    context: FormatContext
): ProfileFieldValue => {
    if (!value.file) {
        return text(value.rawValue)
    }
    const path = `${value.file.endpoint}/image`
    return {
        kind: 'image',
        href: buildApiHref(context.api, path, value.file.params),
        previewHref: buildApiHref(context.api, path, {
            ...value.file.params,
            dimension: 'small',
        }),
        alt: value.label,
    }
}

const formatOrganisationUnit = (
    rawValue: string,
    context: FormatContext
): ProfileFieldValue => {
    const organisationUnit = context.organisationUnits.get(rawValue)
    return organisationUnit
        ? {
              kind: 'organisationUnit',
              name: organisationUnit.name,
              path: organisationUnit.path,
          }
        : text(rawValue)
}

const formatNumber = (rawValue: string, suffix = '') => {
    const parsed = parseNumber(rawValue)
    return text(parsed === undefined ? rawValue : `${parsed}${suffix}`)
}

const formatByValueType = (
    value: FormattableValue & { rawValue: string },
    context: FormatContext
): ProfileFieldValue => {
    const { rawValue } = value
    switch (value.valueType) {
        case 'NUMBER':
        case 'INTEGER':
        case 'INTEGER_POSITIVE':
        case 'INTEGER_NEGATIVE':
        case 'INTEGER_ZERO_OR_POSITIVE':
            return formatNumber(rawValue)
        case 'PERCENTAGE':
            return formatNumber(rawValue, ' %')
        case 'DATE':
        case 'AGE':
            return text(
                formatServerDate(rawValue, context.systemInfo) ?? rawValue
            )
        case 'DATETIME':
            return text(
                formatServerDateTime(rawValue, context.systemInfo) ?? rawValue
            )
        case 'BOOLEAN':
            if (rawValue === 'true') return text(i18n.t('Yes'))
            if (rawValue === 'false') return text(i18n.t('No'))
            return text(rawValue)
        case 'TRUE_ONLY':
            // Capture converts anything but 'true' to null, which renders empty.
            return rawValue === 'true' ? text(i18n.t('Yes')) : EMPTY
        case 'COORDINATE':
            return parseCoordinate(rawValue) ?? text(rawValue)
        case 'GEOJSON':
            return parseGeoJson(rawValue) ?? text(rawValue)
        case 'FILE_RESOURCE':
            return formatFile(value, context)
        case 'IMAGE':
            return formatImage(value, context)
        case 'ORGANISATION_UNIT':
            return formatOrganisationUnit(rawValue, context)
        default:
            // TEXT, LONG_TEXT, LETTER, PHONE_NUMBER, EMAIL, URL, USERNAME,
            // TIME, UNIT_INTERVAL, TRACKER_ASSOCIATE, REFERENCE and
            // MULTI_TEXT without options show the raw value, as in Capture.
            return text(rawValue)
    }
}

/**
 * Capture's clientToView rules (`CAP/converters/clientToView.tsx:55-85`): option
 * names, MULTI_TEXT lists, calendar dates, `N %`, Yes/No, Lat/Long, Polygon,
 * file links, image previews and org-unit names with their ancestor path.
 */
export const formatValue = (
    value: FormattableValue,
    context: FormatContext
): ProfileFieldValue => {
    const { rawValue } = value
    if (rawValue === null || rawValue === '') {
        return EMPTY
    }
    if (value.options) {
        return text(formatOptionValue(value.options, rawValue, value.valueType))
    }
    return formatByValueType({ ...value, rawValue }, context)
}

export const createValueFormatter = (
    context: FormatContext
): ValueFormatter => ({
    format: (value) => formatValue(value, context),
    formatDateTime: (value) =>
        formatServerDateTime(value, context.systemInfo) ?? value,
})
