import { useComposedField } from '../hooks'
import { useFinderContext } from '../provider/context'
import type { FormField } from '../rules/types'
import { issueText } from './inputs/issueText'
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
 * Registers a field part and resolves what it renders: its config problem,
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
    | { state: 'problem'; message: string }
    | { state: 'pending'; label: string }
    | { state: 'ready'; input: FieldInputProps } => {
    const { state } = useFinderContext()
    const field = useComposedField(attribute, match)
    if (field.problem) {
        return { state: 'problem', message: field.problem }
    }
    const { found } = field
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
            value: field.value,
            setValue: field.setValue,
            error: field.issue ? issueText(field.issue, found) : undefined,
        },
    }
}
