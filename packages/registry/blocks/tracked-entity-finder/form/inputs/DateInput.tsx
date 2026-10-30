import React, { useCallback } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import { FieldDescription, FieldError } from '@/components/dhis2/ui/field'
import { CalendarDateInput } from '../../calendar/CalendarDateInput'
import { useFinderContext } from '../../provider/context'
import type { FieldInputProps } from './types'

/** A day on the server calendar; DATETIME attributes search the whole day. */
export const DateInput = ({
    label,
    description,
    className,
    value,
    setValue,
    error,
}: FieldInputProps) => {
    const { meta } = useFinderContext()
    // Stable, so the memoised calendar skips renders for other fields.
    const onChange = useCallback(
        (date: string) => setValue({ kind: 'date', date }),
        [setValue]
    )
    if (!meta.info) {
        return null
    }
    return (
        <div
            data-invalid={error ? true : undefined}
            className={cn('flex flex-col gap-1', className)}
        >
            <CalendarDateInput
                label={label}
                info={meta.info}
                invalid={error !== undefined}
                value={value?.kind === 'date' ? (value.date ?? '') : ''}
                onChange={onChange}
            />
            {description && <FieldDescription>{description}</FieldDescription>}
            {error && <FieldError>{error}</FieldError>}
        </div>
    )
}
