import i18n from '@dhis2/d2-i18n'
import type {
    DataTableBooleanFilter,
    DataTableDateFilter,
    DataTableFilterValue,
    DataTableNumberFilter,
    DataTableOptionsFilter,
    DataTableTextFilter,
    DataTableTextOperator,
} from '../types'

/** What a control edits before Apply. Inputs keep their raw text. */
export interface TextDraft {
    operator: DataTableTextOperator
    text: string
}
export interface NumberDraft {
    min: string
    max: string
}
export interface DateDraft {
    from: string
    to: string
}
export interface OptionsDraft {
    values: readonly string[]
}
export interface BooleanDraft {
    value: boolean | undefined
}

/** Applying a draft yields a value (undefined clears the filter) or an error. */
export type DraftResult =
    | { ok: true; value: DataTableFilterValue | undefined }
    | { ok: false; error: string }

const valueOf = (
    value: DataTableFilterValue | undefined
): DraftResult & { ok: true } => ({ ok: true, value })

export const textOperators = (
    filter: DataTableTextFilter
): readonly DataTableTextOperator[] =>
    filter.operators && filter.operators.length > 0
        ? filter.operators
        : ['contains']

export const isPresenceOperator = (operator: DataTableTextOperator) =>
    operator === 'empty' || operator === 'notEmpty'

export const textDraft = (
    filter: DataTableTextFilter,
    value: DataTableFilterValue | undefined
): TextDraft => {
    const operators = textOperators(filter)
    if (value?.kind === 'text' && operators.includes(value.operator)) {
        return { operator: value.operator, text: value.text }
    }
    return { operator: operators[0], text: '' }
}

export const readTextDraft = (draft: TextDraft): DraftResult => {
    if (isPresenceOperator(draft.operator)) {
        return valueOf({ kind: 'text', operator: draft.operator, text: '' })
    }
    const text = draft.text.trim()
    return valueOf(
        text === ''
            ? undefined
            : { kind: 'text', operator: draft.operator, text }
    )
}

const numberText = (number: number | undefined) =>
    number === undefined ? '' : String(number)

export const numberDraft = (
    value: DataTableFilterValue | undefined
): NumberDraft =>
    value?.kind === 'number'
        ? { min: numberText(value.min), max: numberText(value.max) }
        : { min: '', max: '' }

const parseNumber = (text: string): number | undefined => {
    if (text.trim() === '') return undefined
    const number = Number(text)
    return Number.isFinite(number) ? number : undefined
}

export const readNumberDraft = (draft: NumberDraft): DraftResult => {
    const min = parseNumber(draft.min)
    const max = parseNumber(draft.max)
    if (min !== undefined && max !== undefined && min > max) {
        return {
            ok: false,
            error: i18n.t('Minimum must not be greater than maximum'),
        }
    }
    if (min === undefined && max === undefined) return valueOf(undefined)
    return valueOf({
        kind: 'number',
        ...(min !== undefined && { min }),
        ...(max !== undefined && { max }),
    })
}

export const dateDraft = (
    value: DataTableFilterValue | undefined
): DateDraft =>
    value?.kind === 'date'
        ? { from: value.from ?? '', to: value.to ?? '' }
        : { from: '', to: '' }

const isoDate = /^\d{4}-\d{2}-\d{2}$/

export const readDateDraft = (draft: DateDraft): DraftResult => {
    const from = isoDate.test(draft.from) ? draft.from : undefined
    const to = isoDate.test(draft.to) ? draft.to : undefined
    if (from !== undefined && to !== undefined && from > to) {
        return { ok: false, error: i18n.t('From must not be after to') }
    }
    if (from === undefined && to === undefined) return valueOf(undefined)
    return valueOf({
        kind: 'date',
        ...(from !== undefined && { from }),
        ...(to !== undefined && { to }),
    })
}

export const optionsDraft = (
    value: DataTableFilterValue | undefined
): OptionsDraft => ({ values: value?.kind === 'options' ? value.values : [] })

export const readOptionsDraft = (draft: OptionsDraft): DraftResult =>
    valueOf(
        draft.values.length === 0
            ? undefined
            : { kind: 'options', values: draft.values }
    )

export const booleanDraft = (
    value: DataTableFilterValue | undefined
): BooleanDraft => ({
    value: value?.kind === 'boolean' ? value.value : undefined,
})

export const readBooleanDraft = (draft: BooleanDraft): DraftResult =>
    valueOf(
        draft.value === undefined
            ? undefined
            : { kind: 'boolean', value: draft.value }
    )

/** The props every built-in control gets. */
interface FilterControlProps<TFilter, TDraft> {
    filter: TFilter
    draft: TDraft
    onDraftChange: (draft: TDraft) => void
}

export type TextControlProps = FilterControlProps<
    DataTableTextFilter,
    TextDraft
>
export type NumberControlProps = FilterControlProps<
    DataTableNumberFilter,
    NumberDraft
>
export type DateControlProps = FilterControlProps<
    DataTableDateFilter,
    DateDraft
>
export type OptionsControlProps = FilterControlProps<
    DataTableOptionsFilter,
    OptionsDraft
>
export type BooleanControlProps = FilterControlProps<
    DataTableBooleanFilter,
    BooleanDraft
>
