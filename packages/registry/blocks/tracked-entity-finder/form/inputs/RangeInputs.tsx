import i18n from '@dhis2/d2-i18n'
import React, { useCallback, useId, type ReactNode } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { CalendarDateInput } from '../../calendar/CalendarDateInput'
import { useFinderContext } from '../../provider/context'
import type { FieldInputProps } from './types'

/** The labelled group around a From–To pair. */
const RangeFrame = ({
    label,
    description,
    error,
    className,
    children,
}: Pick<FieldInputProps, 'label' | 'description' | 'error' | 'className'> & {
    children: ReactNode
}) => (
    <fieldset
        data-invalid={error ? true : undefined}
        className={cn(
            'm-0 flex min-w-0 flex-col gap-1 border-0 p-0',
            className
        )}
    >
        <legend className="mb-1 p-0 text-sm leading-snug">{label}</legend>
        <div className="flex flex-wrap gap-3 *:min-w-32 *:flex-1">
            {children}
        </div>
        {description && <FieldDescription>{description}</FieldDescription>}
        {error && <FieldError>{error}</FieldError>}
    </fieldset>
)

const RangeNumberSide = ({
    label,
    value,
    invalid,
    placeholder,
    onChange,
}: {
    label: string
    value: string
    invalid: boolean
    placeholder?: string
    onChange: (next: string) => void
}) => {
    const id = useId()
    return (
        <Field className="gap-1">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder={placeholder}
                aria-invalid={invalid || undefined}
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </Field>
    )
}

/** From–To numbers; either side alone counts. */
export const NumberRangeInput = ({
    value,
    setValue,
    placeholder,
    ...frame
}: FieldInputProps) => {
    const range = value?.kind === 'numberRange' ? value : { min: '', max: '' }
    const invalid = frame.error !== undefined
    return (
        <RangeFrame {...frame}>
            <RangeNumberSide
                label={i18n.t('From')}
                value={range.min}
                invalid={invalid}
                placeholder={placeholder}
                onChange={(min) =>
                    setValue({ kind: 'numberRange', min, max: range.max })
                }
            />
            <RangeNumberSide
                label={i18n.t('To')}
                value={range.max}
                invalid={invalid}
                placeholder={placeholder}
                onChange={(max) =>
                    setValue({ kind: 'numberRange', min: range.min, max })
                }
            />
        </RangeFrame>
    )
}

/** From–To days on the server calendar; either side alone counts. */
export const DateRangeInput = ({
    value,
    setValue,
    placeholder: _placeholder,
    ...frame
}: FieldInputProps) => {
    const { meta } = useFinderContext()
    const range: { from?: string; to?: string } =
        value?.kind === 'dateRange' ? value : {}
    const { from, to } = range
    // Each end's callback carries the other end, so it changes only with it.
    const setFrom = useCallback(
        (next: string) => setValue({ kind: 'dateRange', from: next, to }),
        [setValue, to]
    )
    const setTo = useCallback(
        (next: string) => setValue({ kind: 'dateRange', from, to: next }),
        [setValue, from]
    )
    if (!meta.info) {
        return null
    }
    const invalid = frame.error !== undefined
    return (
        <RangeFrame {...frame}>
            <CalendarDateInput
                label={i18n.t('From')}
                info={meta.info}
                invalid={invalid}
                value={from ?? ''}
                onChange={setFrom}
            />
            <CalendarDateInput
                label={i18n.t('To')}
                info={meta.info}
                invalid={invalid}
                value={to ?? ''}
                onChange={setTo}
            />
        </RangeFrame>
    )
}
