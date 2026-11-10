import i18n from '@dhis2/d2-i18n'
import { useMemo, useRef, useState } from 'react'
import { optionIndex, searchOptions } from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    Combobox,
    ComboboxChip,
    ComboboxChips,
    ComboboxChipsInput,
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
import type { PopupEditorProps } from './popupEditors'
import { EditorButtons } from './EditorButtons'

const NO_OPTIONS: ReadonlyArray<Option> = []

// Option names are said as the option set gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/**
 * A multi-select as a search over checkboxes. The shared option search narrows the list to 50 options, shown in the
 * option set's order; a choice made before a search stays. Each change is reported, not saved: Save, or leaving the
 * editor, saves the codes in option-set order, joined by commas ("Clear all" saves no value at once). Options a rule
 * hid are not offered, unless the stored value holds one, which can still be unchecked. In a form, five or fewer
 * visible options are a plain list of checkboxes, and more a combobox that shows each choice as a chip.
 */
export const MultiSelectEditor = ({
    field,
    value,
    hiddenOptions,
    labelledBy,
    invalid,
    inline,
    save,
    report,
    cancel,
    announce = announceInHouse,
}: PopupEditorProps) => {
    const options = field.options ?? NO_OPTIONS
    const anchor = useComboboxAnchor()
    const area = useRef<HTMLDivElement>(null)
    const [stored] = useState<ReadonlySet<string>>(
        () => new Set(value?.split(','))
    )
    const [selected, setSelected] = useState(stored)
    const [query, setQuery] = useState('')
    // In a form the editor is always there: its count is news once the search is typed in, not when it appears.
    const [searched, setSearched] = useState(!inline)
    const offered = useMemo(
        () =>
            hiddenOptions === undefined
                ? options
                : options.filter(
                      ({ code }) => !hiddenOptions.has(code) || stored.has(code)
                  ),
        [options, hiddenOptions, stored]
    )
    const listed = inline && visibleCount(options, hiddenOptions) <= RADIO_LIMIT
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
    const news = found.codes.length === 0 ? i18n.t('No matches') : count
    useAnnounced(searched ? news : '', announce)

    // A code the option set lacks is not kept.
    const choice = (codes: ReadonlySet<string>) => {
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
        const { value: text, names } = choice(next)
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
    const toggle = (code: string, checked: boolean) => {
        const next = new Set(selected)
        if (checked) {
            next.add(code)
        } else {
            next.delete(code)
        }
        choose(next)
    }
    const items = found.codes.map((code) => (
        <FieldItem key={code}>
            <Checkbox
                checked={selected.has(code)}
                onCheckedChange={(checked) => toggle(code, checked)}
            />
            <FieldLabel className="cursor-pointer">
                {index.names.get(code)}
            </FieldLabel>
        </FieldItem>
    ))
    // Each box takes the field's invalid state. In a form the field's fieldset is the group, named by its legend.
    const boxes = (className: string) => (
        <Field
            invalid={invalid}
            className={className}
            {...(listed
                ? {}
                : { role: 'group', 'aria-labelledby': labelledBy })}
        >
            {items}
        </Field>
    )
    const chosen = offered.filter(({ code }) => selected.has(code))
    let picker
    if (listed) {
        picker = boxes('flex flex-col gap-2')
    } else if (inline) {
        picker = (
            <Combobox
                // Ranked and limited by `searchOptions`, not filtered again.
                items={found.codes}
                filter={null}
                multiple
                autoHighlight
                value={chosen.map(({ code }) => code)}
                onValueChange={(codes: string[]) => choose(new Set(codes))}
                onInputValueChange={(text, { reason }) => {
                    setQuery(text)
                    if (reason === 'input-change') {
                        setSearched(true)
                    }
                }}
                itemToStringLabel={(code: string) =>
                    index.names.get(code) ?? code
                }
            >
                <ComboboxChips ref={anchor}>
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
    } else {
        picker = (
            <>
                <Input
                    type="search"
                    value={query}
                    aria-labelledby={labelledBy}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={({ target }) => {
                        setQuery(target.value)
                        setSearched(true)
                    }}
                    className="h-(--dhis2-field-height-dense)"
                />
                {found.codes.length === 0 ? (
                    <p className="text-dhis2-muted-foreground">
                        {i18n.t('No matches')}
                    </p>
                ) : (
                    boxes(
                        'flex max-h-60 flex-col gap-2 overflow-y-auto overscroll-contain'
                    )
                )}
                {count === '' ? null : (
                    <p className="text-xs text-dhis2-muted-foreground">
                        {count}
                    </p>
                )}
            </>
        )
    }
    return (
        <>
            {inline ? <div ref={area}>{picker}</div> : picker}
            <EditorButtons
                save={() => save(choice(selected).value)}
                cancel={cancel}
                inline={inline}
            >
                {inline && chosen.length === 0 ? undefined : (
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="me-auto"
                        onClick={() => {
                            // In a form the editor stays, so its boxes show the cleared choice.
                            if (inline) {
                                setSelected(new Set())
                            }
                            save(null)
                            // The button leaves with the choice; focus goes to the choice, not the page.
                            area.current
                                ?.querySelector<HTMLElement>(
                                    '[role="checkbox"], [role="combobox"]'
                                )
                                ?.focus()
                        }}
                    >
                        {i18n.t('Clear all')}
                    </Button>
                )}
            </EditorButtons>
        </>
    )
}
