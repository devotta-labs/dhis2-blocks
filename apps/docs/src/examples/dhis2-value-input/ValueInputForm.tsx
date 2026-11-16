import { useState } from 'react'
import { ValueInput } from '@/components/dhis2-value-input'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { FieldGroup, FieldLegend, FieldSet } from '@/components/dhis2/ui/field'

/**
 * An example: a small form where the host passes what its rules say. Hemoglobin is required and carries a message,
 * the registration number is read-only, and the "Refer" outcome is hidden. Nothing is saved anywhere: Save lists the
 * committed values.
 */

const SETTINGS: ValueSettings = {
    calendar: 'iso8601',
    dateFormat: 'YYYY-MM-DD',
}

const HEMOGLOBIN: Field = { valueType: 'NUMBER' }
const REGISTRATION: Field = { valueType: 'TEXT' }
const OUTCOME: Field = {
    valueType: 'TEXT',
    options: [
        { code: 'HOME', name: 'Sent home' },
        { code: 'ADMIT', name: 'Admitted' },
        { code: 'REFER', name: 'Refer' },
    ],
}
const HIDDEN = new Set(['REFER'])

const ValueInputForm = () => {
    const [values, setValues] = useState<Record<string, string | undefined>>({
        registration: 'REG-0042',
    })
    // Fields whose typed text is not a value yet.
    const [problems, setProblems] = useState<ReadonlySet<string>>(new Set())
    const [saved, setSaved] = useState<Record<string, string | undefined>>()
    const commit =
        (id: string) =>
        (value: string | null, problem?: { message: string; text: string }) => {
            setProblems((all) => {
                const next = new Set(all)
                if (problem === undefined) next.delete(id)
                else next.add(id)
                return next
            })
            if (problem === undefined)
                setValues((all) => ({ ...all, [id]: value ?? undefined }))
        }
    const low = values.hemoglobin !== undefined && Number(values.hemoglobin) < 8
    return (
        <form
            className="flex flex-col gap-6"
            onSubmit={(event) => {
                event.preventDefault()
                if (problems.size === 0 && values.hemoglobin !== undefined)
                    setSaved(values)
            }}
        >
            <FieldSet>
                <FieldLegend>Visit</FieldLegend>
                <FieldGroup>
                    <ValueInput
                        field={REGISTRATION}
                        settings={SETTINGS}
                        label="Registration number"
                        value={values.registration}
                        onChange={commit('registration')}
                        readOnly="Assigned by a rule"
                    />
                    <ValueInput
                        field={HEMOGLOBIN}
                        settings={SETTINGS}
                        label="Hemoglobin (g/dL)"
                        description="Measured today"
                        value={values.hemoglobin}
                        onChange={commit('hemoglobin')}
                        required
                        messages={
                            low
                                ? [
                                      {
                                          tone: 'warning',
                                          text: 'Below 8: consider a transfusion',
                                      },
                                  ]
                                : []
                        }
                    />
                    <ValueInput
                        field={OUTCOME}
                        settings={SETTINGS}
                        label="Outcome"
                        value={values.outcome}
                        onChange={commit('outcome')}
                        hiddenOptions={HIDDEN}
                    />
                </FieldGroup>
            </FieldSet>
            <div>
                <Button type="submit">Save</Button>
            </div>
            {saved !== undefined && (
                <pre aria-label="Saved values" className="text-sm">
                    {JSON.stringify(saved, null, 2)}
                </pre>
            )}
        </form>
    )
}

export default ValueInputForm
