import React from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { FieldShell, type FieldWidgetProps } from './FieldShell'
import { useTypedValue } from './useTypedValue'

export const TextField = ({ field, onCommit, disabled }: FieldWidgetProps) => {
    const typed = useTypedValue({ value: field.value, onCommit })
    return (
        <FieldShell field={field}>
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
