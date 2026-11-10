import { useState } from 'react'
import { ValueInput } from '@/components/dhis2-value-input'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'

/**
 * An example: one field of each kind that needs no server. Each field is a value type (and, for a choice, its
 * options); `ValueInput` picks the control. Search and file fields need the DHIS2 app-runtime provider, so they are
 * not shown here.
 */

const SETTINGS: ValueSettings = {
    calendar: 'iso8601',
    dateFormat: 'YYYY-MM-DD',
}

const FIELDS: ReadonlyArray<{ id: string; label: string; field: Field }> = [
    { id: 'name', label: 'Full name', field: { valueType: 'TEXT' } },
    { id: 'weight', label: 'Weight (kg)', field: { valueType: 'NUMBER' } },
    { id: 'seen', label: 'Date seen', field: { valueType: 'DATE' } },
    { id: 'arrived', label: 'Arrival time', field: { valueType: 'TIME' } },
    { id: 'pregnant', label: 'Pregnant', field: { valueType: 'BOOLEAN' } },
    {
        id: 'consent',
        label: 'Consent given',
        field: { valueType: 'TRUE_ONLY' },
    },
    {
        id: 'result',
        label: 'Test result',
        field: {
            valueType: 'TEXT',
            options: [
                { code: 'POS', name: 'Positive' },
                { code: 'NEG', name: 'Negative' },
                { code: 'INV', name: 'Invalid' },
            ],
        },
    },
]

const ValueInputKinds = () => {
    const [values, setValues] = useState<Record<string, string | undefined>>({})
    return (
        <div className="grid gap-4 sm:grid-cols-2">
            {FIELDS.map(({ id, label, field }) => (
                <ValueInput
                    key={id}
                    field={field}
                    settings={SETTINGS}
                    label={label}
                    value={values[id]}
                    onChange={(value, problem) => {
                        // A problem means what was typed is not a value yet: keep the last good value.
                        if (problem === undefined)
                            setValues((all) => ({
                                ...all,
                                [id]: value ?? undefined,
                            }))
                    }}
                />
            ))}
        </div>
    )
}

export default ValueInputKinds
