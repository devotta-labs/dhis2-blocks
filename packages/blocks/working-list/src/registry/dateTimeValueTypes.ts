import { z } from 'zod'
import type { FilterValue, RelativeDatePeriod } from '../domain/model'
import { FilterValueSchema } from '../domain/schemas'
import type { ValueTypeDefinition } from './valueTypeContracts'
import {
    emptyOperators,
    ensureEmptyValue,
    escapeFilterValue,
    isValidEditorDate,
    isValidTime,
    parseDateValue,
    parseEmptySaved,
    parseTimeValue,
    serializeEmptySaved,
} from './valueTypeShared'
import { textDefinition } from './textAndNumericValueTypes'

const defaultToApiDate = (value: string) => value.slice(0, 10)

const addUtcDays = (date: Date, days: number) => {
    const result = new Date(date)
    result.setUTCDate(result.getUTCDate() + days)
    return result
}

const isoDate = (date: Date) => date.toISOString().slice(0, 10)

const defaultResolveRelativeDate = (
    value: {
        period?: RelativeDatePeriod
        startBuffer?: number
        endBuffer?: number
    },
    todayValue?: string
) => {
    const today = new Date(
        `${(todayValue ?? isoDate(new Date())).slice(0, 10)}T12:00:00Z`
    )
    if (value.startBuffer !== undefined || value.endBuffer !== undefined) {
        return {
            start:
                value.startBuffer !== undefined
                    ? isoDate(addUtcDays(today, value.startBuffer))
                    : undefined,
            end:
                value.endBuffer !== undefined
                    ? isoDate(addUtcDays(today, value.endBuffer))
                    : undefined,
        }
    }
    const startOfWeek = addUtcDays(today, -today.getUTCDay())
    switch (value.period) {
        case 'TODAY':
            return { start: isoDate(today), end: isoDate(today) }
        case 'THIS_WEEK':
            return {
                start: isoDate(startOfWeek),
                end: isoDate(addUtcDays(startOfWeek, 6)),
            }
        case 'LAST_WEEK': {
            const start = addUtcDays(startOfWeek, -7)
            return { start: isoDate(start), end: isoDate(addUtcDays(start, 6)) }
        }
        case 'THIS_MONTH':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() + 1,
                            0
                        )
                    )
                ),
            }
        case 'LAST_MONTH':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() - 1,
                            1
                        )
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
                    )
                ),
            }
        case 'LAST_3_MONTHS':
            return {
                start: isoDate(
                    new Date(
                        Date.UTC(
                            today.getUTCFullYear(),
                            today.getUTCMonth() - 3,
                            1
                        )
                    )
                ),
                end: isoDate(
                    new Date(
                        Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0)
                    )
                ),
            }
        case 'THIS_YEAR':
            return {
                start: `${today.getUTCFullYear()}-01-01`,
                end: `${today.getUTCFullYear()}-12-31`,
            }
        default:
            throw new Error(`Unsupported relative date period: ${value.period}`)
    }
}

const parseDateEditorValue = (
    valueType: 'AGE' | 'DATE' | 'DATETIME',
    value: FilterValue
) => {
    const parsed = FilterValueSchema.parse(value)
    if (parsed.kind !== 'dateRange' && parsed.kind !== 'empty') {
        throw new Error(`${valueType} expects a date range or empty value`)
    }
    if (parsed.kind === 'dateRange' && parsed.mode === 'absolute') {
        for (const boundary of [parsed.start, parsed.end]) {
            if (boundary !== undefined && !isValidEditorDate(boundary)) {
                throw new Error('An absolute date boundary requires YYYY-MM-DD')
            }
        }
        if (parsed.start && parsed.end && parsed.start > parsed.end) {
            throw new Error(
                'An absolute date range start cannot exceed its end'
            )
        }
    }
    return parsed
}

export const dateDefinition = (
    valueType: 'AGE' | 'DATE' | 'DATETIME'
): ValueTypeDefinition => ({
    valueType,
    editor: 'dateRange',
    parseServerValue(value) {
        return parseDateValue(valueType, value)
    },
    parseEditorValue(value) {
        return parseDateEditorValue(valueType, value)
    },
    format(value, _field, context) {
        const stringValue = z.string().safeParse(value)
        if (!stringValue.success || !stringValue.data) {
            return ''
        }
        const parsedValue = stringValue.data
        const transformed = context?.formatDate?.(parsedValue, valueType)
        if (transformed !== undefined) {
            return transformed
        }
        const date = new Date(
            valueType === 'DATE' || valueType === 'AGE'
                ? `${parsedValue.slice(0, 10)}T00:00:00Z`
                : parsedValue
        )
        if (Number.isNaN(date.getTime())) {
            return parsedValue
        }
        const options: Intl.DateTimeFormatOptions =
            valueType === 'DATETIME'
                ? { dateStyle: 'medium', timeStyle: 'short' }
                : { dateStyle: 'medium', timeZone: 'UTC' }
        return new Intl.DateTimeFormat(context?.locale, options).format(date)
    },
    display(value, field, context) {
        const text = this.format(value, field, context)
        return text ? { kind: 'text', text } : { kind: 'empty', text: '' }
    },
    operators(_field, capabilities) {
        return ['range', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter, context) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'dateRange') {
            throw new Error(`${valueType} expects a date range filter`)
        }
        const toApiDate = context?.toApiDate ?? defaultToApiDate
        const range =
            filter.value.mode === 'absolute'
                ? { start: filter.value.start, end: filter.value.end }
                : (context?.resolveRelativeDate?.(filter.value) ??
                  defaultResolveRelativeDate(filter.value, context?.today))
        return [
            range.start
                ? `ge:${escapeFilterValue(toApiDate(range.start))}`
                : undefined,
            range.end
                ? `le:${escapeFilterValue(toApiDate(range.end))}`
                : undefined,
        ]
            .filter(Boolean)
            .join(':')
    },
    serializeSaved(filter, context) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'dateRange') {
            throw new Error(`${valueType} expects a date range filter`)
        }
        const toApiDate = context?.toApiDate ?? defaultToApiDate
        return {
            dateFilter:
                filter.value.mode === 'absolute'
                    ? {
                          type: 'ABSOLUTE',
                          startDate: filter.value.start
                              ? toApiDate(filter.value.start)
                              : undefined,
                          endDate: filter.value.end
                              ? toApiDate(filter.value.end)
                              : undefined,
                      }
                    : {
                          type: 'RELATIVE',
                          period: filter.value.period,
                          startBuffer: filter.value.startBuffer,
                          endBuffer: filter.value.endBuffer,
                      },
        }
    },
    parseSaved(filter, context) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (!filter.dateFilter) {
            throw new Error(`Saved ${valueType} filter has no dateFilter`)
        }
        const value = FilterValueSchema.parse(
            filter.dateFilter.type === 'ABSOLUTE'
                ? {
                      kind: 'dateRange',
                      mode: 'absolute',
                      start: filter.dateFilter.startDate
                          ? (context?.fromApiDate?.(
                                filter.dateFilter.startDate
                            ) ?? filter.dateFilter.startDate)
                          : undefined,
                      end: filter.dateFilter.endDate
                          ? (context?.fromApiDate?.(
                                filter.dateFilter.endDate
                            ) ?? filter.dateFilter.endDate)
                          : undefined,
                  }
                : {
                      kind: 'dateRange',
                      mode: 'relative',
                      period: filter.dateFilter.period,
                      startBuffer: filter.dateFilter.startBuffer,
                      endBuffer: filter.dateFilter.endBuffer,
                  }
        )
        return parseDateEditorValue(valueType, value)
    },
})

const parseTimeEditorValue = (value: FilterValue) => {
    const parsed = FilterValueSchema.parse(value)
    if (parsed.kind !== 'timeRange' && parsed.kind !== 'empty') {
        throw new Error('TIME expects a time range or empty value')
    }
    if (parsed.kind === 'timeRange') {
        for (const boundary of [parsed.min, parsed.max]) {
            if (boundary !== undefined && !isValidTime(boundary)) {
                throw new Error('A time boundary requires HH:mm')
            }
        }
        if (parsed.min && parsed.max && parsed.min > parsed.max) {
            throw new Error('A time range minimum cannot exceed its maximum')
        }
    }
    return parsed
}

export const timeDefinition: ValueTypeDefinition = {
    ...textDefinition('TIME'),
    editor: 'timeRange',
    parseServerValue: parseTimeValue,
    parseEditorValue: parseTimeEditorValue,
    operators(_field, capabilities) {
        return ['range', ...emptyOperators(capabilities)]
    },
    serializeQuery(filter) {
        const empty = ensureEmptyValue(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'timeRange') {
            throw new Error('TIME expects a time range filter')
        }
        return [
            filter.value.min
                ? `ge:${escapeFilterValue(filter.value.min)}`
                : undefined,
            filter.value.max
                ? `le:${escapeFilterValue(filter.value.max)}`
                : undefined,
        ]
            .filter(Boolean)
            .join(':')
    },
    serializeSaved(filter) {
        const empty = serializeEmptySaved(filter)
        if (empty) {
            return empty
        }
        if (filter.value.kind !== 'timeRange') {
            throw new Error('TIME expects a time range filter')
        }
        return { ge: filter.value.min, le: filter.value.max }
    },
    parseSaved(filter) {
        const empty = parseEmptySaved(filter)
        if (empty) {
            return empty
        }
        return parseTimeEditorValue(
            FilterValueSchema.parse({
                kind: 'timeRange',
                min: filter.ge,
                max: filter.le,
            })
        )
    },
}
