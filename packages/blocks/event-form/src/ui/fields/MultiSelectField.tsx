import React, { useMemo } from 'react'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    useComboboxAnchor,
} from '@/registry/dhis2/ui/combobox'
import { selectTriggerVariants } from '@/registry/dhis2/ui/select'
import { useEventFormText } from '../EventFormText'
import { choiceLabel } from './choices'
import { FieldShell, type FieldWidgetProps } from './FieldShell'

/** A multi-select option set: the selections show as chips, the options as checkboxes. */
export const MultiSelectField = ({
    field,
    onCommit,
    disabled,
}: FieldWidgetProps) => {
    const translate = useEventFormText()
    const anchor = useComboboxAnchor()
    const choices = field.choices ?? []
    const labels = useMemo(
        () =>
            new Map(
                choices.map((choice) => [
                    choice.value,
                    choiceLabel(choice, translate),
                ])
            ),
        [choices, translate]
    )
    const codes = useMemo(
        () => choices.map((choice) => choice.value),
        [choices]
    )
    const selected = field.value === undefined ? [] : field.value.split(',')
    const labelFor = (code: string) => labels.get(code) ?? code
    // Codes are committed in the option set's order, whatever order they were picked in.
    const commit = (next: readonly string[]) => {
        const ordered = codes.filter((code) => next.includes(code))
        onCommit(ordered.length === 0 ? undefined : ordered.join(','))
    }
    return (
        <FieldShell field={field}>
            {({ id, ...control }) => (
                <Combobox
                    items={codes}
                    itemToStringLabel={labelFor}
                    multiple
                    disabled={disabled}
                    value={selected}
                    onValueChange={(next: string[]) => commit(next)}
                >
                    {/* The trigger covers the whole box so a press anywhere opens it; the chips
                        sit above it and only their remove buttons take the pointer. */}
                    <div
                        ref={anchor}
                        className={cn(
                            selectTriggerVariants({ size: 'default' }),
                            'relative cursor-default pe-6 has-[>[data-slot=combobox-trigger]:focus-visible]:border-dhis2-ring has-[>[data-slot=combobox-trigger]:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-dhis2-ring)]'
                        )}
                    >
                        <ComboboxTrigger
                            {...control}
                            id={id}
                            className="absolute inset-0 flex cursor-pointer items-center rounded-dhis2-sm border-0 bg-transparent pe-1 outline-none"
                        />
                        <ComboboxChips className="pointer-events-none relative min-h-6 flex-1 [&_[data-slot=combobox-chip-remove]]:pointer-events-auto">
                            {selected.map((code) => (
                                <ComboboxChip
                                    key={code}
                                    showRemove={!disabled}
                                    removeLabel={translate('Remove {{label}}', {
                                        label: labelFor(code),
                                    })}
                                >
                                    {labelFor(code)}
                                </ComboboxChip>
                            ))}
                        </ComboboxChips>
                    </div>
                    <ComboboxContent anchor={anchor}>
                        <ComboboxInput
                            showTrigger={false}
                            placeholder={translate('Search')}
                            aria-label={translate('Search')}
                        />
                        <ComboboxEmpty>
                            {translate('No options match')}
                        </ComboboxEmpty>
                        <ComboboxList>
                            {(code: string) => (
                                <ComboboxItem
                                    key={code}
                                    value={code}
                                    indicator="checkbox"
                                >
                                    {labelFor(code)}
                                </ComboboxItem>
                            )}
                        </ComboboxList>
                    </ComboboxContent>
                </Combobox>
            )}
        </FieldShell>
    )
}
