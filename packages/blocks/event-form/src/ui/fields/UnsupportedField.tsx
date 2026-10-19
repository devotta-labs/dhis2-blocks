import React from 'react'
import { useEventFormText } from '../EventFormText'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/** The stored value, read-only, and why it cannot be edited here. */
export const UnsupportedField = ({ field }: FieldWidgetProps) => {
    const translate = useEventFormText()
    return (
        <FieldShell field={field}>
            {(control) => (
                <div
                    id={control.id}
                    role="group"
                    aria-labelledby={control['aria-labelledby']}
                    aria-describedby={control['aria-describedby']}
                    className="flex flex-col gap-1"
                >
                    {field.value !== undefined && (
                        <p className="m-0 min-h-10 rounded-dhis2-sm border border-dhis2-input bg-dhis2-grey-100 px-3 py-2.5 text-sm break-words text-dhis2-grey-900">
                            {field.value}
                        </p>
                    )}
                    <p className="m-0 text-sm text-dhis2-grey-700">
                        {field.unsupportedReason === 'noOptions'
                            ? translate(
                                  'No options are available for this field'
                              )
                            : translate(
                                  'This value type is not supported here'
                              )}
                    </p>
                </div>
            )}
        </FieldShell>
    )
}
