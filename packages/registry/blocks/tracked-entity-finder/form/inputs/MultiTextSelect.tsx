import i18n from '@dhis2/d2-i18n'
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
                <ComboboxChipsTrigger
                    anchorRef={anchor}
                    id={id}
                    aria-invalid={error ? true : undefined}
                >
                    {selected.length === 0 ? (
                        <span className="text-dhis2-grey-600">
                            {placeholder ?? i18n.t('Any')}
                        </span>
                    ) : (
                        <ComboboxChips className="min-h-6">
                            {selected.map((code) => (
                                <ComboboxChip
                                    key={code}
                                    removeLabel={i18n.t('Remove {{name}}', {
                                        name: nameOf(code),
                                        interpolation: { escapeValue: false },
                                    })}
                                >
                                    {nameOf(code)}
                                </ComboboxChip>
                            ))}
                        </ComboboxChips>
                    )}
                </ComboboxChipsTrigger>
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
