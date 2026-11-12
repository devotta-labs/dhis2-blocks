import React, { useCallback } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
} from '@/components/dhis2/ui/field'
import { CalendarDateInput } from '../../calendar/CalendarDateInput'
import { useSystemInfo } from '../../api/queries'
import type { FieldInputProps } from './types'

/** A day on the server calendar; DATETIME attributes search the whole day. */
export const DateInput = ({
    label,
    description,
    className,
    value,
    setValue,
    onBlur,
    error,
}: FieldInputProps) => {
    const { data: info } = useSystemInfo()
    // Stable, so the memoised calendar skips renders for other fields.
    const onChange = useCallback(
        (date: string) => setValue({ kind: 'date', date }),
        [setValue]
    )
    if (!info) {
        return null
    }
    return (
        <Field
            invalid={error !== undefined}
            className={cn('gap-1', className)}
            // Blur bubbles in React, so leaving the calendar's input counts.
            onBlur={onBlur}
        >
            <CalendarDateInput
                label={label}
                info={info}
                invalid={error !== undefined}
                value={value?.kind === 'date' ? (value.date ?? '') : ''}
                onChange={onChange}
            />
            {description && <FieldDescription>{description}</FieldDescription>}
            {error && <FieldError>{error}</FieldError>}
        </Field>
    )
}
