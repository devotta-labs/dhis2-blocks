import { useState } from 'react'
import { ValueInput } from '@/components/dhis2-value-input'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'

/**
 * An example: one field of each kind that needs no server. Each field is a value type (and, for a choice, its
 * options); `ValueInput` picks the control. Search and file fields fetch from DHIS2, so they are not shown here.
 */

const SETTINGS: ValueSettings = {
    calendar: 'iso8601',
    dateFormat: 'YYYY-MM-DD',
}

const FIELDS: ReadonlyArray<{ id: string; label: string; field: Field }> = [
    { id: 'name', label: 'Full name', field: { valueType: 'TEXT' } },
    { id: 'weight', label: 'Weight (kg)', field: { valueType: 'NUMBER' } },
    { id: 'seen', label: 'Date seen', field: { valueType: 'DATE' } },
    {
        id: 'admitted',
        label: 'Admitted at',
        field: { valueType: 'DATETIME' },
    },
    { id: 'arrived', label: 'Arrival time', field: { valueType: 'TIME' } },
    { id: 'age', label: 'Age', field: { valueType: 'AGE' } },
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
    {
        id: 'symptoms',
        label: 'Symptoms',
        field: {
            valueType: 'MULTI_TEXT',
            options: [
                { code: 'FEVER', name: 'Fever' },
                { code: 'COUGH', name: 'Cough' },
                { code: 'RASH', name: 'Rash' },
            ],
        },
    },
    {
        id: 'occupation',
        label: 'Occupation',
        field: {
            valueType: 'TEXT',
            options: [
                { code: 'FARM', name: 'Farmer' },
                { code: 'TEACH', name: 'Teacher' },
                { code: 'TRADE', name: 'Trader' },
                { code: 'HEALTH', name: 'Health worker' },
                { code: 'STUDENT', name: 'Student' },
                { code: 'MINER', name: 'Miner' },
                { code: 'FISHER', name: 'Fisher' },
                { code: 'OTHER', name: 'Other' },
            ],
        },
    },
    {
        id: 'danger',
        label: 'Danger signs',
        field: {
            valueType: 'MULTI_TEXT',
            options: [
                { code: 'CONV', name: 'Convulsions' },
                { code: 'LETH', name: 'Lethargy' },
                { code: 'VOMIT', name: 'Vomiting everything' },
                { code: 'DRINK', name: 'Unable to drink' },
                { code: 'BREATH', name: 'Difficult breathing' },
                { code: 'BLEED', name: 'Abnormal bleeding' },
                { code: 'JAUND', name: 'Jaundice' },
            ],
        },
    },
    { id: 'home', label: 'Home location', field: { valueType: 'COORDINATE' } },
    { id: 'notes', label: 'Notes', field: { valueType: 'LONG_TEXT' } },
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
