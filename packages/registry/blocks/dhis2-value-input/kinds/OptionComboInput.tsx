import i18n from '@dhis2/d2-i18n'
import { useMemo, useState } from 'react'
import { optionIndex, searchOptions } from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import {
    Combobox,
    ComboboxContent,
    ComboboxEmpty,
    ComboboxInput,
    ComboboxItem,
    ComboboxList,
} from '@/components/dhis2/ui/combobox'
import { matchCount, useAnnounced } from '../announce'

/** A long option set: one input showing the option's name, and typing lists the matches to pick from. */
export const OptionComboInput = ({
    id,
    offered,
    value,
    shown,
    readOnly,
    required,
    pick,
}: {
    id: string
    /** The options a person may choose, in the option set's order. */
    offered: ReadonlyArray<Option>
    value: string | undefined
    /** The stored value as text: its option's name, or what the display block makes of a value no option has. */
    shown: string
    readOnly: boolean
    required: boolean
    pick(code: string): void
}) => {
    const index = useMemo(() => optionIndex(offered), [offered])
    // What is being typed; `null` shows the stored value. Typing alone never reports.
    const [query, setQuery] = useState<string | null>(null)
    const found = useMemo(
        () => searchOptions(index, query ?? ''),
        [index, query]
    )
    const count = matchCount(found.codes.length, found.total)
    const news = found.codes.length === 0 ? i18n.t('No matches') : count
    useAnnounced(query === null ? '' : news)
    return (
        <Combobox
            // Ranked and limited by `searchOptions`, not filtered again.
            items={found.codes}
            filter={null}
            value={value !== undefined && index.names.has(value) ? value : null}
            inputValue={query ?? shown}
            onInputValueChange={(text, { reason }) => {
                if (reason === 'input-change') {
                    setQuery(text)
                }
            }}
            onValueChange={(code) => {
                setQuery(null)
                if (code !== null) {
                    pick(code)
                }
            }}
            onOpenChange={(open) => {
                if (!open) {
                    setQuery(null)
                }
            }}
            itemToStringLabel={(code) => index.names.get(code) ?? code}
            readOnly={readOnly}
        >
            <ComboboxInput
                id={id}
                autoComplete="off"
                spellCheck={false}
                aria-required={required || undefined}
            />
            <ComboboxContent>
                <ComboboxEmpty>{i18n.t('No matches')}</ComboboxEmpty>
                <ComboboxList>
                    {(code: string) => (
                        <ComboboxItem key={code} value={code}>
                            {index.names.get(code)}
                        </ComboboxItem>
                    )}
                </ComboboxList>
            </ComboboxContent>
        </Combobox>
    )
}
