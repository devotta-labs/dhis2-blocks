import type { FieldValue, FinderAttribute } from '../../rules/types'

/** What every field input gets from FinderField or FinderRangeField. */
export interface FieldInputProps {
    attribute: FinderAttribute
    label: string
    description?: string
    placeholder?: string
    className?: string
    value?: FieldValue
    setValue: (value: FieldValue) => void
    /** Marks the field left, so its error shows. */
    onBlur: () => void
    /** The error to show; the input is marked invalid while set. */
    error?: string
}
