import React, { useId, useMemo } from 'react'
import { cn } from '../primitives/cn'
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
    ComboboxValue,
    useComboboxAnchor,
} from '../primitives/combobox'
import { Field, FieldLabel } from '../primitives/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    selectTriggerVariants,
} from '../primitives/select'
import { Spinner } from '../primitives/spinner'
import { useWorkingListText } from '../WorkingListText'

export interface SelectFieldOption<Value extends string = string> {
    value: Value
    label: string
}

/** A labelled dense select: the shadcn stand-in for SingleSelectField. */
export const SelectField = <Value extends string>({
    label,
    dataTest,
    value,
    options,
    onChange,
}: {
    label: string
    dataTest?: string
    value?: Value
    options: readonly SelectFieldOption<Value>[]
    onChange: (value: Value) => void
}) => {
    const triggerId = useId()
    return (
        <Field data-test={dataTest} className="gap-0.5">
            <FieldLabel htmlFor={triggerId}>{label}</FieldLabel>
            <Select
                items={options}
                value={value ?? null}
                onValueChange={(next) => {
                    if (next !== null) {
                        onChange(next)
                    }
                }}
            >
                <SelectTrigger id={triggerId} size="sm">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </Field>
    )
}

/**
 * A labelled, filterable dense select: the shadcn stand-in for a filterable
 * SingleSelectField or MultiSelectField. With `multiple`, selections show as
 * chips in the box (collapsing to a count after `collapseAfter`) and options
 * show checkboxes, as in @dhis2/ui MultiSelect.
 *
 * Options are filtered locally unless `onSearchChange` is given, in which case
 * the caller filters (e.g. on the server) and `loading` shows a spinner.
 */
export const ComboboxField = ({
    label,
    dataTest,
    multiple = false,
    values,
    options,
    noMatchText,
    filterPlaceholder,
    collapseAfter,
    loading = false,
    onSearchChange,
    onChange,
}: {
    label: string
    dataTest?: string
    multiple?: boolean
    values: readonly string[]
    options: readonly SelectFieldOption[]
    noMatchText: string
    filterPlaceholder?: string
    collapseAfter?: number
    loading?: boolean
    onSearchChange?: (search: string) => void
    onChange: (values: string[]) => void
}) => {
    const translate = useWorkingListText()
    const triggerId = useId()
    const anchor = useComboboxAnchor()
    const labels = useMemo(
        () => new Map(options.map((option) => [option.value, option.label])),
        [options]
    )
    const items = useMemo(
        () => options.map((option) => option.value),
        [options]
    )
    const labelFor = (value: string) => labels.get(value) ?? value
    // A caller that searches remotely gets the input text and does its own
    // filtering; otherwise Base UI filters the options by label.
    const filter = onSearchChange ? null : undefined
    const content = (
        <ComboboxContent anchor={multiple ? anchor : undefined}>
            <ComboboxInput
                showTrigger={false}
                placeholder={filterPlaceholder}
                aria-label={filterPlaceholder ?? label}
            />
            <ComboboxEmpty>
                {loading ? <Spinner className="size-4" /> : noMatchText}
            </ComboboxEmpty>
            {/* A new search keeps the previous results listed until it
                resolves, so show that it is still loading above them. */}
            {loading && items.length > 0 && (
                <div className="flex justify-center px-6 py-2">
                    <Spinner className="size-4" />
                </div>
            )}
            <ComboboxList>
                {(value: string) => (
                    <ComboboxItem
                        key={value}
                        value={value}
                        indicator={multiple ? 'checkbox' : 'check'}
                    >
                        {labelFor(value)}
                    </ComboboxItem>
                )}
            </ComboboxList>
        </ComboboxContent>
    )

    if (!multiple) {
        return (
            <Field data-test={dataTest} className="gap-0.5">
                <FieldLabel htmlFor={triggerId}>{label}</FieldLabel>
                <Combobox
                    items={items}
                    itemToStringLabel={labelFor}
                    filter={filter}
                    onInputValueChange={onSearchChange}
                    value={values[0] ?? null}
                    onValueChange={(next: string | null) =>
                        onChange(next === null ? [] : [next])
                    }
                >
                    <ComboboxTrigger
                        id={triggerId}
                        className={selectTriggerVariants({ size: 'sm' })}
                    >
                        <span className="min-w-0 flex-1 truncate">
                            <ComboboxValue />
                        </span>
                    </ComboboxTrigger>
                    {content}
                </Combobox>
            </Field>
        )
    }

    const collapsed =
        collapseAfter !== undefined && values.length > collapseAfter
    return (
        <Field data-test={dataTest} className="gap-0.5">
            <FieldLabel htmlFor={triggerId}>{label}</FieldLabel>
            <Combobox
                items={items}
                itemToStringLabel={labelFor}
                filter={filter}
                onInputValueChange={onSearchChange}
                multiple
                value={[...values]}
                onValueChange={(next: string[]) => onChange(next)}
            >
                {/* The trigger covers the whole box so a press anywhere opens
                    it; the chips sit above it and only their remove buttons
                    take the pointer. */}
                <div
                    ref={anchor}
                    className={cn(
                        selectTriggerVariants({ size: 'sm' }),
                        'relative cursor-default pe-6 has-[>[data-slot=combobox-trigger]:focus-visible]:border-ring has-[>[data-slot=combobox-trigger]:focus-visible]:shadow-[inset_0_0_0_2px_var(--color-ring)] has-[>[data-slot=combobox-trigger][data-popup-open]]:border-ring has-[>[data-slot=combobox-trigger][data-popup-open]]:shadow-[inset_0_0_0_2px_var(--color-ring)]'
                    )}
                >
                    <ComboboxTrigger
                        id={triggerId}
                        className="absolute inset-0 flex cursor-pointer items-center rounded-sm border-0 bg-transparent pe-1 outline-none"
                    />
                    {collapsed ? (
                        <span className="pointer-events-none relative flex-1">
                            {translate('{{count}} selected', {
                                count: values.length,
                            })}
                        </span>
                    ) : (
                        <ComboboxChips className="pointer-events-none relative min-h-6 flex-1 [&_[data-slot=combobox-chip-remove]]:pointer-events-auto">
                            {values.map((value) => (
                                <ComboboxChip
                                    key={value}
                                    removeLabel={translate('Remove {{label}}', {
                                        label: labelFor(value),
                                    })}
                                >
                                    {labelFor(value)}
                                </ComboboxChip>
                            ))}
                        </ComboboxChips>
                    )}
                </div>
                {content}
            </Combobox>
        </Field>
    )
}
