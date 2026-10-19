import React, { useEffect, useState } from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { useEventFormText } from '../EventFormText'
import { DatePicker } from './DateField'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

interface Parts {
    date?: string
    time?: string
}

const DATE_TIME = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/

const partsOf = (value: string | undefined): Parts => {
    const match = value === undefined ? null : DATE_TIME.exec(value)
    return match === null ? {} : { date: match[1], time: match[2] }
}

/**
 * A date and a time. The value is committed only once both are set. While one is missing the
 * parts are kept here, the stored value is cleared, and once the focus has left the field the
 * error names the missing part.
 */
export const DateTimeField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const [draft, setDraft] = useState<Parts>()
    const [left, setLeft] = useState(false)
    const [dateError, setDateError] = useState<string>()
    // A committed value is the truth again; the draft only covers an incomplete entry.
    useEffect(() => {
        if (field.value !== undefined) {
            setDraft(undefined)
        }
    }, [field.value])

    const parts = draft ?? partsOf(field.value)
    const update = (change: Parts) => {
        const next = { ...parts, ...change }
        if (next.date !== undefined && next.time !== undefined) {
            setDraft(undefined)
            onCommit(`${next.date}T${next.time}`)
            return
        }
        setDraft(next)
        if (field.value !== undefined) {
            onCommit(undefined)
        }
    }

    const missing =
        left && dateError === undefined
            ? parts.date === undefined && parts.time !== undefined
                ? 'Enter a date'
                : parts.time === undefined && parts.date !== undefined
                  ? 'Enter a time'
                  : undefined
            : undefined

    return (
        <FieldShell field={field} localError={dateError ?? missing}>
            {(control) => (
                <div
                    className="flex flex-wrap items-start gap-2"
                    onBlur={(event) => {
                        if (
                            !event.currentTarget.contains(event.relatedTarget)
                        ) {
                            setLeft(true)
                        }
                    }}
                    onFocus={() => setLeft(false)}
                >
                    <div className="min-w-0 flex-1 basis-48">
                        <DatePicker
                            control={control}
                            value={parts.date}
                            disabled={disabled}
                            onChange={(date) => update({ date })}
                            onError={setDateError}
                        />
                    </div>
                    <Input
                        type="time"
                        aria-label={translate('{{label}} (time)', {
                            label: field.label,
                        })}
                        aria-invalid={control['aria-invalid']}
                        disabled={disabled}
                        className="w-36"
                        value={parts.time ?? ''}
                        onChange={(event) =>
                            update({
                                time:
                                    event.target.value === ''
                                        ? undefined
                                        : event.target.value,
                            })
                        }
                    />
                </div>
            )}
        </FieldShell>
    )
}
