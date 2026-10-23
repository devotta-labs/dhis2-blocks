import React, { useId } from 'react'
import { Input } from '@/components/dhis2/ui/input'
import { FieldFrame } from './FieldFrame'
import type { FieldInputProps } from './types'

/** A number as typed; the rules check it, so invalid text can be flagged. */
export const NumberInput = ({
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
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholder}
                aria-invalid={error ? true : undefined}
                value={value?.kind === 'number' ? value.value : ''}
                onChange={(event) =>
                    setValue({ kind: 'number', value: event.target.value })
                }
            />
        </FieldFrame>
    )
}
