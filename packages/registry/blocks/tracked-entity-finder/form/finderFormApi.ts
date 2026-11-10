import { useField, useForm } from '@tanstack/react-form'
import { useMemo } from 'react'
import { errorCodeOf, fieldSchema } from '../rules/fieldSchema'
import type { FieldValue, FinderAttribute, FormField } from '../rules/types'
import { errorText } from './errorText'

/** A finder form's values: one `FieldValue` per attribute uid. */
export type FinderValues = Record<string, FieldValue | undefined>

const NO_VALUES: FinderValues = Object.freeze({})

/** Internal: the TanStack form behind one `FinderForm`. */
export const useFinderFormApi = (onSubmit: (values: FinderValues) => void) =>
    useForm({
        defaultValues: NO_VALUES,
        onSubmit: ({ value }) => onSubmit(value),
    })

/** The TanStack form of the `FinderForm` around it. */
export type FinderFormApi = ReturnType<typeof useFinderFormApi>

/**
 * The field's Zod schema as a TanStack validator: the error is the text to
 * show the user. TanStack runs it on change and again on submit.
 */
const useValidator = (
    attribute: FinderAttribute | undefined,
    match: FormField['match']
) =>
    useMemo(() => {
        if (!attribute) {
            return undefined
        }
        const schema = fieldSchema(attribute, match)
        return ({ value }: { value: FieldValue | undefined }) => {
            const result = schema.safeParse(value)
            const code = result.success ? undefined : errorCodeOf(result.error)
            return code ? errorText(code, attribute) : undefined
        }
    }, [attribute, match])

/**
 * Internal: one attribute's TanStack field. Without an attribute (it has a
 * metadata error) it is not validated, as it is left out of the search.
 */
export const useFinderFieldApi = (
    form: FinderFormApi,
    attribute: string,
    usable: FinderAttribute | undefined,
    match: FormField['match']
) => {
    const validator = useValidator(usable, match)
    return useField({
        form,
        name: attribute,
        validators: { onChange: validator },
    })
}

/** One attribute's TanStack field in a finder form. */
export type FinderFieldApi = ReturnType<typeof useFinderFieldApi>
