import React from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import { RadioGroup, RadioGroupItem } from '@/registry/dhis2/ui/radio-group'
import { ToggleGroup, ToggleGroupItem } from '@/registry/dhis2/ui/toggle-group'
import { useEventFormText } from '../EventFormText'
import { ClearValueButton } from './ClearValueButton'
import { choiceLabel } from './choices'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/**
 * Yes/No and short option sets as toggle buttons, where picking the picked one again clears it,
 * or as radio buttons when the stage asks for them.
 */
export const ChoiceField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const choices = field.choices ?? []
    const radioLayout = field.radioLayout
    return (
        <FieldShell field={field}>
            {({
                id,
                'aria-invalid': invalid,
                'aria-required': required,
                ...labelling
            }) =>
                radioLayout !== undefined ? (
                    <div className="flex items-start gap-1">
                        <RadioGroup
                            {...labelling}
                            id={id}
                            aria-invalid={invalid}
                            aria-required={required}
                            value={field.value ?? null}
                            disabled={disabled}
                            data-orientation={radioLayout}
                            className={cn(
                                radioLayout === 'horizontal' &&
                                    'flex flex-row flex-wrap gap-x-4'
                            )}
                            onValueChange={(next) =>
                                onCommit(
                                    next === null ? undefined : String(next)
                                )
                            }
                        >
                            {choices.map((choice) => (
                                <label
                                    key={choice.value}
                                    className="flex cursor-pointer items-center gap-2 text-sm text-dhis2-grey-900"
                                >
                                    <RadioGroupItem
                                        value={choice.value}
                                        aria-invalid={invalid}
                                    />
                                    {choiceLabel(choice, translate)}
                                </label>
                            ))}
                        </RadioGroup>
                        {field.value !== undefined && (
                            <ClearValueButton
                                disabled={disabled}
                                onClear={() => onCommit(undefined)}
                            />
                        )}
                    </div>
                ) : (
                    // A group has no invalid or required state; its description carries the messages.
                    <ToggleGroup
                        {...labelling}
                        id={id}
                        variant="outline"
                        value={field.value === undefined ? [] : [field.value]}
                        disabled={disabled}
                        onValueChange={(next) => onCommit(next[0])}
                    >
                        {choices.map((choice) => (
                            <ToggleGroupItem
                                key={choice.value}
                                value={choice.value}
                                className="data-pressed:border-dhis2-primary data-pressed:bg-dhis2-primary data-pressed:text-dhis2-primary-foreground data-pressed:hover:bg-dhis2-primary"
                            >
                                {choiceLabel(choice, translate)}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                )
            }
        </FieldShell>
    )
}
