import i18n from '@dhis2/d2-i18n'
import React, { useId, useMemo } from 'react'
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
} from '@/components/dhis2/ui/combobox'
import { FieldFrame } from './FieldFrame'
import type { FieldInputProps } from './types'

const NO_CODES: readonly string[] = []

/**
 * A MULTI_TEXT option set: the user picks any number of names, shown as
 * chips, and the person must have every code picked.
 */
export const MultiTextSelect = ({
    attribute,
    label,
    description,
    placeholder,
    className,
    error,
    value,
    setValue,
}: FieldInputProps) => {
    const id = useId()
    const anchor = useComboboxAnchor()
    const options = attribute.options ?? []
    const names = useMemo(
        () => new Map(options.map(({ code, name }) => [code, name])),
        [options]
    )
    const codes = useMemo(() => options.map(({ code }) => code), [options])
    const selected = value?.kind === 'multiText' ? value.codes : NO_CODES
    const nameOf = (code: string) => names.get(code) ?? code
    return (
        <FieldFrame
            controlId={id}
            label={label}
            description={description}
            error={error}
            className={className}
        >
            <Combobox
                items={codes}
                itemToStringLabel={nameOf}
                multiple
                value={[...selected]}
                onValueChange={(next: string[]) =>
                    setValue({ kind: 'multiText', codes: next })
                }
            >
                {/* The trigger covers the whole box, so a press anywhere opens
                    it; only the chips' remove buttons sit above it. */}
                <ComboboxChips
                    ref={anchor}
                    className="pe-6 [&_[data-slot=combobox-chip-remove]]:relative"
                >
                    <ComboboxTrigger
                        id={id}
                        aria-invalid={error ? true : undefined}
                        className="absolute inset-0 flex cursor-pointer items-center rounded-dhis2-sm border-0 bg-transparent pe-2 outline-none forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:-outline-offset-2"
                    />
                    {selected.length === 0 ? (
                        <span className="text-dhis2-subtle-foreground">
                            {placeholder ?? i18n.t('Any')}
                        </span>
                    ) : (
                        selected.map((code) => (
                            <ComboboxChip
                                key={code}
                                removeLabel={i18n.t('Remove {{name}}', {
                                    name: nameOf(code),
                                    interpolation: { escapeValue: false },
                                })}
                            >
                                {nameOf(code)}
                            </ComboboxChip>
                        ))
                    )}
                </ComboboxChips>
                <ComboboxContent anchor={anchor}>
                    <ComboboxInput
                        showTrigger={false}
                        placeholder={i18n.t('Filter options')}
                        aria-label={i18n.t('Filter {{label}}', {
                            label,
                            interpolation: { escapeValue: false },
                        })}
                    />
                    <ComboboxEmpty>{i18n.t('No options match')}</ComboboxEmpty>
                    <ComboboxList>
                        {(code: string) => (
                            <ComboboxItem
                                key={code}
                                value={code}
                                indicator="checkbox"
                            >
                                {nameOf(code)}
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
        </FieldFrame>
    )
}
