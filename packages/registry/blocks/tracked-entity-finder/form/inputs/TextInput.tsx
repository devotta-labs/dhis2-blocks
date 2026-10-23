import React, { useId } from 'react'
import { Input } from '@/components/dhis2/ui/input'
import { FieldFrame } from './FieldFrame'
import type { FieldInputProps } from './types'

/** Free text, searched with the attribute's text operator. */
export const TextInput = ({
    label,
    description,
    placeholder,
    className,
    value,
    setValue,
    error,
}: FieldInputProps) => {
    const id = useId()
    return (
        <FieldFrame
            controlId={id}
            label={label}
            description={description}
            error={error}
            className={className}
        >
            <Input
                id={id}
                type="text"
                autoComplete="off"
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                value={value?.kind === 'text' ? value.text : ''}
                onChange={(event) =>
                    setValue({ kind: 'text', text: event.target.value })
                }
            />
        </FieldFrame>
    )
}
