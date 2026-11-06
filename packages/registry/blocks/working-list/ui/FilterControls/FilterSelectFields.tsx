import React, { useId, useMemo } from 'react'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsTrigger,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
    ComboboxTrigger,
    ComboboxValue,
    useComboboxAnchor,
} from '@/components/dhis2/ui/combobox'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
    selectTriggerVariants,
} from '@/components/dhis2/ui/select'
import { Spinner } from '@/components/dhis2/ui/spinner'
import { useWorkingListText } from '../WorkingListText'

export interface SelectFieldOption<Value extends string = string> {
    value: Value
    label: string
}

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
    const filter = onSearchChange ? null : undefined
    const content = (
        <ComboboxContent anchor={multiple ? anchor : undefined}>
            <ComboboxInput
                showTrigger={false}
                placeholder={filterPlaceholder}
                aria-label={filterPlaceholder ?? label}
            />
            <ComboboxEmpty>
                {loading ? (
                    <Spinner
                        aria-label={translate('Loading')}
                        className="size-4"
                    />
                ) : (
                    noMatchText
                )}
            </ComboboxEmpty>
            {/* A new search keeps the previous results listed until it
                resolves, so show that it is still loading above them. */}
            {loading && items.length > 0 && (
                <div className="flex justify-center px-6 py-2">
                    <Spinner
                        aria-label={translate('Loading')}
                        className="size-4"
                    />
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
                <ComboboxChipsTrigger
                    anchorRef={anchor}
                    id={triggerId}
                    size="sm"
                >
                    {collapsed ? (
                        <span>
                            {translate('{{count}} selected', {
                                count: values.length,
                            })}
                        </span>
                    ) : (
                        <ComboboxChips className="min-h-6">
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
                </ComboboxChipsTrigger>
                {content}
            </Combobox>
        </Field>
    )
}
