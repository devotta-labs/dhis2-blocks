import React from 'react'
import { Textarea } from '@/registry/dhis2/ui/textarea'
import { FieldShell, type FieldWidgetProps } from './FieldShell'
import { useTypedValue } from './useTypedValue'

/** Enter adds a line, so a long text commits on blur only. */
export const LongTextField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const typed = useTypedValue({ value: field.value, onCommit })
    return (
        <FieldShell field={field}>
            {(control) => (
                <Textarea
                    {...control}
                    disabled={disabled}
                    value={typed.text}
                    onChange={(event) => typed.onChange(event.target.value)}
                    onBlur={typed.onBlur}
                />
            )}
        </FieldShell>
    )
}
