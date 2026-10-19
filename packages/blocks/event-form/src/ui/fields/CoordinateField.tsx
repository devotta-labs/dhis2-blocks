import React, { useState } from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { useEventFormText } from '../EventFormText'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

interface Draft {
    latitude: string
    longitude: string
}

const COORDINATE = /^\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\]$/
const DECIMAL = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/

const draftOf = (value: string | undefined): Draft => {
    const match = value === undefined ? null : COORDINATE.exec(value)
    return match === null
        ? { latitude: '', longitude: '' }
        : { latitude: match[2], longitude: match[1] }
}

/** The untranslated error for one half of a coordinate, or `undefined` when it is acceptable. */
const rangeError = (
    text: string,
    limit: number,
    message: string
): string | undefined =>
    DECIMAL.test(text) && Math.abs(Number(text)) <= limit ? undefined : message

/**
 * Latitude and longitude, committed as `[longitude,latitude]`. Both halves are checked when the
 * focus leaves the field or Enter is pressed; the value is committed only when both are valid, and
 * is cleared only when both are empty.
 */
export const CoordinateField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const [draft, setDraft] = useState<Draft>()
    const [error, setError] = useState<string>()
    const shown = draft ?? draftOf(field.value)

    const finish = () => {
        if (draft === undefined) {
            return
        }
        const latitude = draft.latitude.trim()
        const longitude = draft.longitude.trim()
        if (latitude === '' && longitude === '') {
            setError(undefined)
            setDraft(undefined)
            if (field.value !== undefined) {
                onCommit(undefined)
            }
            return
        }
        const problem =
            latitude === ''
                ? 'Enter a latitude'
                : longitude === ''
                  ? 'Enter a longitude'
                  : (rangeError(
                        latitude,
                        90,
                        'Enter a latitude between -90 and 90'
                    ) ??
                    rangeError(
                        longitude,
                        180,
                        'Enter a longitude between -180 and 180'
                    ))
        if (problem !== undefined) {
            setError(problem)
            return
        }
        setError(undefined)
        setDraft(undefined)
        const next = `[${longitude},${latitude}]`
        if (next !== field.value) {
            onCommit(next)
        }
    }

    const change = (part: keyof Draft, text: string) => {
        setDraft({ ...shown, [part]: text })
        setError(undefined)
    }

    // A plain labelled input: wrapping it in an InputGroup would add two levels of components.
    const input = (
        part: keyof Draft,
        label: string,
        control: { describedBy?: string; invalid?: true }
    ) => (
        <label className="flex min-w-40 flex-1 flex-col gap-0.5 text-xs text-dhis2-grey-700">
            {label}
            <Input
                type="text"
                inputMode="decimal"
                aria-describedby={control.describedBy}
                aria-invalid={control.invalid}
                disabled={disabled}
                value={shown[part]}
                onChange={(event) => change(part, event.target.value)}
                onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                        finish()
                    }
                }}
            />
        </label>
    )

    return (
        <FieldShell field={field} localError={error}>
            {(control) => (
                <div
                    id={control.id}
                    role="group"
                    aria-labelledby={control['aria-labelledby']}
                    className="flex flex-wrap gap-2"
                    onBlur={(event) => {
                        if (
                            !event.currentTarget.contains(event.relatedTarget)
                        ) {
                            finish()
                        }
                    }}
                >
                    {input('latitude', translate('Latitude'), {
                        describedBy: control['aria-describedby'],
                        invalid: control['aria-invalid'],
                    })}
                    {input('longitude', translate('Longitude'), {
                        describedBy: control['aria-describedby'],
                        invalid: control['aria-invalid'],
                    })}
                </div>
            )}
        </FieldShell>
    )
}
