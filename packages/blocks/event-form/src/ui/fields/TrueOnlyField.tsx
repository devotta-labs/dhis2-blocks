import React from 'react'
import { Checkbox } from '@/registry/dhis2/ui/checkbox'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/** A box that is either ticked (`true`) or empty: a true-only value cannot be `false`. */
export const TrueOnlyField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => (
    <FieldShell field={field}>
        {(control) => (
            <Checkbox
                {...control}
                checked={field.value === 'true'}
                disabled={disabled}
                onCheckedChange={(checked) =>
                    onCommit(checked ? 'true' : undefined)
                }
            />
        )}
    </FieldShell>
)
