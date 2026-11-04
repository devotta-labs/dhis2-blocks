import { useComposedField } from '../hooks'
import { useFinderContext } from '../provider/context'
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
    const { state } = useFinderContext()
    const { found, field, error, metadataError } = useComposedField(
        attribute,
        match
    )
    if (metadataError) {
        return { state: 'metadata-error', message: metadataError }
    }
    // Inputs wait for the server calendar too, not only the program.
    if (!found || state.status !== 'ready') {
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
