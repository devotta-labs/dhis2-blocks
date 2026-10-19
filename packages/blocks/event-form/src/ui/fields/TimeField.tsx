import React from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/** The browser's time input produces `HH:mm` itself, so each change is committed. */
export const TimeField = ({ field, onCommit, disabled }: FieldWidgetProps) => (
    <FieldShell field={field}>
        {(control) => (
            <Input
                {...control}
                type="time"
                disabled={disabled}
                className="w-40"
                value={field.value ?? ''}
                onChange={(event) =>
                    onCommit(
                        event.target.value === ''
                            ? undefined
                            : event.target.value
                    )
                }
            />
        )}
    </FieldShell>
)
