import type { ColumnFilter } from '@tanstack/react-table'
import { z } from 'zod'
import type { DataTableFilterValue } from './types'

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

export const dataTableFilterValueSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('text'),
        operator: z.enum([
            'contains',
            'equals',
            'startsWith',
            'empty',
            'notEmpty',
        ]),
        text: z.string(),
    }),
    z.object({
        kind: z.literal('number'),
        min: z.number().optional(),
        max: z.number().optional(),
    }),
    z.object({
        kind: z.literal('date'),
        from: isoDate.optional(),
        to: isoDate.optional(),
    }),
    z.object({
        kind: z.literal('options'),
        values: z.array(z.string()).readonly(),
    }),
    z.object({ kind: z.literal('boolean'), value: z.boolean() }),
    z.object({ kind: z.literal('custom'), value: z.string() }),
]) satisfies z.ZodType<DataTableFilterValue>

export const parseDataTableFilterValue = (
    columnFilter: ColumnFilter
): DataTableFilterValue | undefined => {
    const result = dataTableFilterValueSchema.safeParse(columnFilter.value)
    return result.success ? result.data : undefined
}

export const isDataTableFilterValueEmpty = (
    value: DataTableFilterValue
): boolean => {
    switch (value.kind) {
        case 'text':
            return (
                value.operator !== 'empty' &&
                value.operator !== 'notEmpty' &&
                value.text.trim() === ''
            )
        case 'number':
            return value.min === undefined && value.max === undefined
        case 'date':
            return value.from === undefined && value.to === undefined
        case 'options':
            return value.values.length === 0
        case 'boolean':
            return false
        case 'custom':
            return value.value === ''
    }
}
