import i18n from '@dhis2/d2-i18n'
import type { DataTableFilter, DataTableFilterValue } from './types'

// The text is shown as it is; React escapes it.
const raw = { interpolation: { escapeValue: false } } as const

const textSummary = (
    value: Extract<DataTableFilterValue, { kind: 'text' }>
): string => {
    switch (value.operator) {
        case 'empty':
            return i18n.t('Is empty')
        case 'notEmpty':
            return i18n.t('Is not empty')
        case 'startsWith':
            return i18n.t('Starts with {{text}}', { text: value.text, ...raw })
        case 'equals':
            return i18n.t('Is exactly {{text}}', { text: value.text, ...raw })
        case 'contains':
            return value.text
    }
}

const rangeSummary = (from: string | undefined, to: string | undefined) => {
    if (from !== undefined && to !== undefined) {
        return i18n.t('{{from}} – {{to}}', { from, to, ...raw })
    }
    if (from !== undefined) return i18n.t('≥ {{min}}', { min: from, ...raw })
    if (to !== undefined) return i18n.t('≤ {{max}}', { max: to, ...raw })
    return ''
}

const dateSummary = (from: string | undefined, to: string | undefined) => {
    if (from !== undefined && to !== undefined) {
        return i18n.t('{{from}} – {{to}}', { from, to, ...raw })
    }
    if (from !== undefined) return i18n.t('From {{from}}', { from, ...raw })
    if (to !== undefined) return i18n.t('Until {{to}}', { to, ...raw })
    return ''
}

const optionsSummary = (
    filter: DataTableFilter,
    values: readonly string[]
): string => {
    const labels = values.map(
        (value) =>
            (filter.kind === 'options'
                ? filter.options.find((option) => option.value === value)?.label
                : undefined) ?? value
    )
    if (labels.length > 2) {
        return i18n.t('{{label}} +{{count}}', {
            label: labels[0],
            count: labels.length - 1,
            ...raw,
        })
    }
    return labels.join(', ')
}

const booleanSummary = (filter: DataTableFilter, value: boolean): string => {
    const trueLabel = filter.kind === 'boolean' ? filter.trueLabel : undefined
    const falseLabel = filter.kind === 'boolean' ? filter.falseLabel : undefined
    return value ? (trueLabel ?? i18n.t('Yes')) : (falseLabel ?? i18n.t('No'))
}

/** The chip text for a filter value, such as "≥ 18" or "Bo, Kenema". */
export const summarizeDataTableFilter = (
    filter: DataTableFilter,
    value: DataTableFilterValue
): string => {
    switch (value.kind) {
        case 'text':
            return textSummary(value)
        case 'number':
            return rangeSummary(
                value.min === undefined ? undefined : String(value.min),
                value.max === undefined ? undefined : String(value.max)
            )
        case 'date':
            return dateSummary(value.from, value.to)
        case 'options':
            return optionsSummary(filter, value.values)
        case 'boolean':
            return booleanSummary(filter, value.value)
        case 'custom':
            return filter.kind === 'custom'
                ? filter.summarize(value.value)
                : value.value
    }
}
