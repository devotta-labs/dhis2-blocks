import { useComposedField } from '../hooks'
import type { FormField } from '../rules/types'
import type { FieldInputProps } from './inputs/types'

/** What the field parts take besides the attribute. */
export interface FinderFieldPartProps {
    /** A program attribute uid. */
    attribute: string
    /** Replaces the metadata label. */
    label?: string
    description?: string
    placeholder?: string
    className?: string
}

/**
 * Registers a field part and resolves what it renders: its metadata error,
 * a pending stand-in, or the input props.
 */
export const useFieldPart = (
    {
        attribute,
        label,
        description,
        placeholder,
        className,
    }: FinderFieldPartProps,
    match: FormField['match']
):
    | { state: 'metadata-error'; message: string }
    | { state: 'pending'; label: string }
    | { state: 'ready'; input: FieldInputProps } => {
    const {
        attribute: found,
        field,
        error,
        metadataError,
        ready,
    } = useComposedField(attribute, match)
    if (metadataError) {
        return { state: 'metadata-error', message: metadataError }
    }
    if (!found || !ready) {
        return { state: 'pending', label: label ?? found?.label ?? '' }
    }
    return {
        state: 'ready',
        input: {
            attribute: found,
            label: label ?? found.label,
            description,
            placeholder,
            className,
            value: field.state.value,
            setValue: field.handleChange,
            onBlur: field.handleBlur,
            error,
        },
    }
}
