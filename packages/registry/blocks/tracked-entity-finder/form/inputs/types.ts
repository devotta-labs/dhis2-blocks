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
    /** The issue to show; the input is marked invalid while set. */
    error?: string
}
