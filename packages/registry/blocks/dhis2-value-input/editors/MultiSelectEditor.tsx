import i18n from '@dhis2/d2-i18n'
import { useMemo, useState } from 'react'
import { optionIndex, searchOptions } from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
    ComboboxClear,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxItem,
    ComboboxList,
    useComboboxAnchor,
} from '@/components/dhis2/ui/combobox'
import { Field, FieldItem, FieldLabel } from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import { announce as announceInHouse } from '@/components/dhis2/ui/announcer'
import { matchCount, useAnnounced } from '../announce'
import { RADIO_LIMIT, visibleCount } from '../kinds/ChoiceInput'
import type { FormEditorProps, PopupEditorProps } from './popupEditors'
import { EditorButtons } from './EditorButtons'

const NO_OPTIONS: ReadonlyArray<Option> = []

// Option names are said as the option set gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/**
 * The choice and the search over the options. Options a rule hid are not offered, unless the stored value holds one,
 * which can still be unchecked. Each change of choice is reported and said.
 */
const useMultiSelect = ({
    field,
    value,
    hiddenOptions,
    report,
    announce = announceInHouse,
}: Pick<
    PopupEditorProps,
    'field' | 'value' | 'hiddenOptions' | 'report' | 'announce'
>) => {
    const options = field.options ?? NO_OPTIONS
    const [stored] = useState<ReadonlySet<string>>(
        () => new Set(value?.split(','))
    )
    const [selected, setSelected] = useState(stored)
    const [query, setQuery] = useState('')
    const offered = useMemo(
        () =>
            hiddenOptions === undefined
                ? options
                : options.filter(
                      ({ code }) => !hiddenOptions.has(code) || stored.has(code)
                  ),
        [options, hiddenOptions, stored]
    )
    // Each position in the option set, for listing matches in its order.
    const { index, at } = useMemo(
        () => ({
            index: optionIndex(offered),
            at: new Map(offered.map(({ code }, i) => [code, i])),
        }),
        [offered]
    )
    const found = useMemo(() => {
        const { codes, total } = searchOptions(index, query)
        return {
            total,
            codes: codes.sort((a, b) => (at.get(a) ?? 0) - (at.get(b) ?? 0)),
        }
    }, [index, at, query])
    const count = matchCount(found.codes.length, found.total)

    // A code the option set lacks is not kept.
    const valueOf = (codes: ReadonlySet<string>) => {
        const chosen = options.filter(({ code }) => codes.has(code))
        return {
            value:
                chosen.length === 0
                    ? null
                    : chosen.map(({ code }) => code).join(','),
            names: chosen.map(({ name }) => name).join(', '),
        }
    }
    const choose = (next: ReadonlySet<string>) => {
        setSelected(next)
        const { value: text, names } = valueOf(next)
        report(text)
        // With nothing selected the unchecked box says it all.
        if (names !== '') {
            announce(
                i18n.t('Selected options: {{options}}', {
                    nsSeparator: '::',
                    interpolation: AS_IS,
                    options: names,
                })
            )
        }
    }
    return {
        options,
        index,
        found,
        count,
        /** What a search says: the count, or that nothing matched. */
        news: found.codes.length === 0 ? i18n.t('No matches') : count,
        query,
        setQuery,
        selected,
        setSelected,
        /** The offered options selected, in the option set's order. */
        chosen: offered.filter(({ code }) => selected.has(code)),
        value: () => valueOf(selected).value,
        choose,
        toggle: (code: string, checked: boolean) => {
            const next = new Set(selected)
            if (checked) {
                next.add(code)
            } else {
                next.delete(code)
            }
            choose(next)
        },
    }
}

type MultiSelectState = ReturnType<typeof useMultiSelect>

/** A checkbox for each option found. Each box takes the field's invalid state. */
const OptionBoxes = ({
    editor: { found, index, selected, toggle },
    invalid,
    className,
    labelledBy,
}: {
    editor: MultiSelectState
    invalid?: boolean
    className: string
    /** Makes the boxes a group with this name; without it a fieldset around them is the group. */
    labelledBy?: string
}) => (
    <Field
        invalid={invalid}
        className={className}
        {...(labelledBy === undefined
            ? {}
            : { role: 'group', 'aria-labelledby': labelledBy })}
    >
        {found.codes.map((code) => (
            <FieldItem key={code}>
                <Checkbox
                    checked={selected.has(code)}
                    onCheckedChange={(checked) => toggle(code, checked)}
                />
                <FieldLabel className="cursor-pointer">
                    {index.names.get(code)}
                </FieldLabel>
            </FieldItem>
        ))}
    </Field>
)

/**
 * A multi-select as a search over checkboxes. The shared option search narrows the list to 50 options, shown in the
 * option set's order; a choice made before a search stays. Each change is reported, not saved: Save, or leaving the
 * editor, saves the codes in option-set order, joined by commas ("Clear all" saves no value at once). Options a rule
 * hid are not offered, unless the stored value holds one, which can still be unchecked.
 */
export const MultiSelectEditor = (props: PopupEditorProps) => {
    const { labelledBy, save, cancel, announce = announceInHouse } = props
    const editor = useMultiSelect(props)
    const { found, count, query, setQuery } = editor
    useAnnounced(editor.news, announce)
    return (
        <>
            <Input
                type="search"
                value={query}
                aria-labelledby={labelledBy}
                autoComplete="off"
                spellCheck={false}
                onChange={({ target }) => setQuery(target.value)}
                className="h-(--dhis2-field-height-dense)"
            />
            {found.codes.length === 0 ? (
                <p className="text-dhis2-muted-foreground">
                    {i18n.t('No matches')}
                </p>
            ) : (
                <OptionBoxes
                    editor={editor}
                    labelledBy={labelledBy}
                    className="flex max-h-60 flex-col gap-2 overflow-y-auto overscroll-contain"
                />
            )}
            {count === '' ? null : (
                <p className="text-xs text-dhis2-muted-foreground">{count}</p>
            )}
            <EditorButtons save={() => save(editor.value())} cancel={cancel}>
                <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="me-auto"
                    onClick={() => save(null)}
                >
                    {i18n.t('Clear all')}
                </Button>
            </EditorButtons>
        </>
    )
}

/**
 * A multi-select in a form: five or fewer visible options are a plain list of checkboxes, and more a combobox that
 * shows each choice as a chip. Its count is said once the combobox is typed in, not when the field appears.
 */
export const MultiSelectFormEditor = (props: FormEditorProps) => {
    const {
        hiddenOptions,
        labelledBy,
        invalid,
        save,
        announce = announceInHouse,
    } = props
    const editor = useMultiSelect(props)
    const { found, index, chosen, setQuery } = editor
    const anchor = useComboboxAnchor()
    const [searched, setSearched] = useState(false)
    useAnnounced(searched ? editor.news : '', announce)
    const listed = visibleCount(editor.options, hiddenOptions) <= RADIO_LIMIT
    return listed ? (
        <OptionBoxes
            editor={editor}
            invalid={invalid}
            className="flex flex-col gap-2"
        />
    ) : (
        <Combobox
            // Ranked and limited by `searchOptions`, not filtered again.
            items={found.codes}
            filter={null}
            multiple
            autoHighlight
            value={chosen.map(({ code }) => code)}
            onValueChange={(codes: string[], { reason }) => {
                if (reason === 'clear-press') {
                    // Saved at once, not when the field is left; the field stays, showing no chips.
                    editor.setSelected(new Set())
                    save(null)
                } else {
                    editor.choose(new Set(codes))
                }
            }}
            onInputValueChange={(text, { reason }) => {
                setQuery(text)
                if (reason === 'input-change') {
                    setSearched(true)
                }
            }}
            itemToStringLabel={(code: string) => index.names.get(code) ?? code}
        >
            <ComboboxChips
                ref={anchor}
                // Room at the end for the clear button, as in a single input.
                className="relative pe-8"
            >
                {chosen.map(({ code, name }) => (
                    <ComboboxChip
                        key={code}
                        removeLabel={i18n.t('Remove {{name}}', {
                            name,
                            interpolation: AS_IS,
                        })}
                    >
                        {name}
                    </ComboboxChip>
                ))}
                <ComboboxChipsInput
                    aria-labelledby={labelledBy}
                    autoComplete="off"
                    spellCheck={false}
                    className="h-6 bg-transparent"
                />
                <ComboboxClear
                    aria-label={i18n.t('Clear all')}
                    className="absolute end-1 top-1/2 -translate-y-1/2"
                />
            </ComboboxChips>
            <ComboboxContent anchor={anchor}>
                <ComboboxEmpty>{i18n.t('No matches')}</ComboboxEmpty>
                <ComboboxList>
                    {(code: string) => (
                        <ComboboxItem
                            key={code}
                            value={code}
                            indicator="checkbox"
                        >
                            {index.names.get(code)}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
