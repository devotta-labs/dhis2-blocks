import React, { useId } from 'react'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import type { FieldInputProps } from './types'

/** Ticked searches for "yes"; unticked leaves the field out. */
export const TrueOnlyCheckbox = ({
    label,
    description,
    className,
    value,
    setValue,
    error,
}: FieldInputProps) => {
    const id = useId()
    return (
        <Field
            orientation="horizontal"
            data-invalid={error ? true : undefined}
            className={cn('flex-wrap', className)}
        >
            <Checkbox
                id={id}
                aria-invalid={error ? true : undefined}
                checked={value?.kind === 'trueOnly' && value.checked}
                onCheckedChange={(checked) =>
                    setValue({ kind: 'trueOnly', checked })
                }
            />
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {description && (
                <FieldDescription className="basis-full">
                    {description}
                </FieldDescription>
            )}
            {error && <FieldError className="basis-full">{error}</FieldError>}
        </Field>
    )
}
