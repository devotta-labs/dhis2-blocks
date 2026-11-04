import i18n from '@dhis2/d2-i18n'
import React, { useId, useMemo } from 'react'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/dhis2/ui/select'
import { FieldFrame } from './FieldFrame'
import type { FieldInputProps } from './types'

interface Choice {
    value: string
    label: string
}

/** A single choice; "Any" clears it. */
const ChoiceSelect = ({
    label,
    description,
    placeholder,
    className,
    error,
    choices,
    selected,
    onSelect,
}: Omit<FieldInputProps, 'attribute' | 'value' | 'setValue'> & {
    choices: readonly Choice[]
    selected?: string
    onSelect: (value?: string) => void
}) => {
    const id = useId()
    const items = useMemo(
        () => [
            { value: null, label: placeholder ?? i18n.t('Any') },
            ...choices,
        ],
        [choices, placeholder]
    )
    return (
        <FieldFrame
            controlId={id}
            label={label}
            description={description}
            error={error}
            className={className}
        >
            <Select
                items={items}
                value={selected ?? null}
                onValueChange={(next) => onSelect(next ?? undefined)}
            >
                <SelectTrigger id={id} aria-invalid={error ? true : undefined}>
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {items.map((item) => (
                        <SelectItem key={item.value ?? ''} value={item.value}>
                            {item.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </FieldFrame>
    )
}

/** An option set: the user picks a name, the code is searched. */
export const OptionSelect = ({
    attribute,
    value,
    setValue,
    ...props
}: FieldInputProps) => {
    const choices = useMemo(
        () =>
            (attribute.options ?? []).map(({ code, name }) => ({
                value: code,
                label: name,
            })),
        [attribute.options]
    )
    return (
        <ChoiceSelect
            {...props}
            choices={choices}
            selected={value?.kind === 'option' ? value.code : undefined}
            onSelect={(code) => setValue({ kind: 'option', code })}
        />
    )
}

const isAnswer = (value?: string): value is 'true' | 'false' =>
    value === 'true' || value === 'false'

/** Yes or no. */
export const BooleanSelect = ({
    attribute: _attribute,
    value,
    setValue,
    ...props
}: FieldInputProps) => {
    const choices = useMemo(
        () => [
            { value: 'true', label: i18n.t('Yes') },
            { value: 'false', label: i18n.t('No') },
        ],
        []
    )
    return (
        <ChoiceSelect
            {...props}
            choices={choices}
            selected={value?.kind === 'boolean' ? value.value : undefined}
            onSelect={(answer) =>
                setValue({
                    kind: 'boolean',
                    value: isAnswer(answer) ? answer : undefined,
                })
            }
        />
    )
}
