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

export interface FormatContext {
    systemInfo: ProfileSystemInfo
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

const parseNumber = (value: string): number | undefined => {
    const normalized = value.replace(/ /g, '').replace(',', '.')
    if (normalized === '') {
        return undefined
    }
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : undefined
}

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
            return text(rawValue)
    }
}

const formatValue = (
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
