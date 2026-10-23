import { useMemo } from 'react'
import type { ProfileField } from '../../types'
import type {
    FormattableField,
    FormattedFieldsState,
    ValueFormatter,
} from './contracts'
import { useValueFormatter } from './useValueFormatter'

/** One formattable field as a `ProfileField`; options are kept for later editing. */
const toProfileField = (
    field: FormattableField,
    formatter: ValueFormatter
): ProfileField => ({
    id: field.id,
    label: field.label,
    valueType: field.valueType,
    rawValue: field.rawValue,
    value: formatter.format(field),
    options: field.options,
})

/**
 * `useValueFormatter` plus the mapping to `ProfileField` (id, label,
 * valueType, rawValue, value, options). Powers `useProfileFields`.
 */
export function useFormattedFields(
    fields: readonly FormattableField[] | undefined
): FormattedFieldsState {
    const { formatter, error, isPending } = useValueFormatter(fields)
    const data = useMemo(
        () =>
            fields && formatter
                ? fields.map((field) => toProfileField(field, formatter))
                : undefined,
        [fields, formatter]
    )

    return { data, error, isPending: isPending || (error === null && !data) }
}
