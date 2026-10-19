import React from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { FieldShell, type FieldWidgetProps } from './FieldShell'
import { useTypedValue } from './useTypedValue'

const INTEGER = /^-?\d+$/
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Only whether the text is a finished number is checked here, so an unfinished "12." is never
 * committed. Ranges and the rest of the type's rules are checked by the form's validation.
 */
export const NumberField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const wholeNumber = field.inputMode === 'numeric'
    const typed = useTypedValue({
        value: field.value,
        onCommit,
        validate: (text) =>
            (wholeNumber ? INTEGER : DECIMAL).test(text)
                ? undefined
                : wholeNumber
                  ? 'Enter a whole number'
                  : 'Enter a number',
    })
    return (
        <FieldShell field={field} localError={typed.error}>
            {(control) => (
                <Input
                    {...control}
                    type="text"
                    inputMode={field.inputMode}
                    disabled={disabled}
                    value={typed.text}
                    onChange={(event) => typed.onChange(event.target.value)}
                    onBlur={typed.onBlur}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            typed.onEnter()
                        }
                    }}
                />
            )}
        </FieldShell>
    )
}
