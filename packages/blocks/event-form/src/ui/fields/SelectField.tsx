import React, { useMemo } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/registry/dhis2/ui/select'
import { useEventFormText } from '../EventFormText'
import { ClearValueButton } from './ClearValueButton'
import { choiceLabel } from './choices'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/** A larger option set as a dropdown. */
export const SelectField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const items = useMemo(
        () =>
            (field.choices ?? []).map((choice) => ({
                value: choice.value,
                label: choiceLabel(choice, translate),
            })),
        [field.choices, translate]
    )
    return (
        <FieldShell field={field}>
            {(control) => (
                <div className="flex items-center gap-1">
                    <Select
                        items={items}
                        value={field.value ?? null}
                        disabled={disabled}
                        onValueChange={(next) => onCommit(next ?? undefined)}
                    >
                        <SelectTrigger {...control}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {items.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {field.value !== undefined && (
                        <ClearValueButton
                            disabled={disabled}
                            onClear={() => onCommit(undefined)}
                        />
                    )}
                </div>
            )}
        </FieldShell>
    )
}
