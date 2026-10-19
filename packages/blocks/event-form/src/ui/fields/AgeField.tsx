import React, { useState } from 'react'
import { useEventFormText } from '../EventFormText'
import { ageBetween } from './calendar'
import { DatePicker } from './DateField'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

const todayIso = () => {
    const now = new Date()
    const pad = (value: number) => value.toString().padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A date of birth, with the age it makes today. */
export const AgeField = ({ field, onCommit, disabled }: FieldWidgetProps) => {
    const translate = useEventFormText()
    const [error, setError] = useState<string>()
    const age =
        field.value === undefined
            ? undefined
            : ageBetween(field.value, todayIso())
    return (
        <FieldShell field={field} localError={error}>
            {(control) => (
                <div className="flex flex-col gap-1">
                    <DatePicker
                        control={control}
                        value={field.value}
                        disabled={disabled}
                        onChange={onCommit}
                        onError={setError}
                    />
                    {age !== undefined && (
                        <p className="m-0 text-sm text-dhis2-grey-700">
                            {translate(
                                '{{years}} years, {{months}} months, {{days}} days',
                                age
                            )}
                        </p>
                    )}
                </div>
            )}
        </FieldShell>
    )
}
