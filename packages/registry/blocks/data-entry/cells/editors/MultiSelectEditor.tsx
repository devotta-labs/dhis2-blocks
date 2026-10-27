import i18n from '@dhis2/d2-i18n'
import { useMemo, useState } from 'react'
import { optionIndex, searchOptions } from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { useDataEntryContext } from '../../provider/context'
import { matchCount, useAnnounced } from '../OptionCell'
import type { PopupEditorProps } from '../popupEditors'
import { EditorButtons } from './EditorButtons'

const NO_OPTIONS: ReadonlyArray<Option> = []

// Option names are said as the option set gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

/**
 * A multi-select as a search over checkboxes. The shared option search narrows the list to 50 options, shown in the
 * option set's order; a choice made before a search stays. Each change is reported, not saved: Save, or leaving the
 * editor, saves the codes in option-set order, joined by commas ("Clear all" saves no value at once). Options a rule
 * hid are not offered, unless the stored value holds one, which can still be unchecked.
 */
export const MultiSelectEditor = ({
    field,
    value,
    hiddenOptions,
    labelledBy,
    save,
    report,
    cancel,
}: PopupEditorProps) => {
    const { announce } = useDataEntryContext()
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
    useAnnounced(found.codes.length === 0 ? i18n.t('No matches') : count)

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
    const toggle = (code: string, checked: boolean) => {
        const next = new Set(selected)
        if (checked) {
            next.add(code)
        } else {
            next.delete(code)
        }
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
                <p className="text-dhis2-grey-700">{i18n.t('No matches')}</p>
            ) : (
                <div
                    role="group"
                    aria-labelledby={labelledBy}
                    className="flex max-h-60 flex-col gap-2 overflow-y-auto overscroll-contain"
                >
                    {found.codes.map((code) => (
                        <Label key={code} className="cursor-pointer">
                            <Checkbox
                                checked={selected.has(code)}
                                onCheckedChange={(checked) =>
                                    toggle(code, checked)
                                }
                            />
                            {index.names.get(code)}
                        </Label>
                    ))}
                </div>
            )}
            {count === '' ? null : (
                <p className="text-xs text-dhis2-grey-700">{count}</p>
            )}
            <EditorButtons
                save={() => save(choice(selected).value)}
                cancel={cancel}
            >
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
