import i18n from '@dhis2/d2-i18n'
import { useMemo, useRef, useState } from 'react'
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
import { composing } from '../composing'
import type { useDraft } from '../useDraft'

/**
 * A long option set: one input showing the option's name, and typing lists the matches to pick from. Typing highlights
 * the top match, which Enter or Tab picks; other typed text is committed when the field is left or Enter is pressed,
 * as a typed field's is, so a name or code is taken and anything else is refused. Unless required, a chosen option
 * has a clear button in the input.
 */
export const OptionComboInput = ({
    id,
    offered,
    value,
    draft,
    readOnly,
    required,
}: {
    id: string
    /** The options a person may choose, in the option set's order. */
    offered: ReadonlyArray<Option>
    value: string | undefined
    /** The typed text, checked against the offered options only. */
    draft: ReturnType<typeof useDraft>
    readOnly: boolean
    required: boolean
}) => {
    const index = useMemo(() => optionIndex(offered), [offered])
    const [typing, setTyping] = useState(false)
    const highlighted = useRef<string>()
    const query = typing ? draft.text : ''
    const found = useMemo(() => searchOptions(index, query), [index, query])
    const count = matchCount(found.codes.length, found.total)
    const news = found.codes.length === 0 ? i18n.t('No matches') : count
    useAnnounced(typing ? news : '')
    const pick = (code: string) => {
        setTyping(false)
        draft.change(code)
        draft.commit()
    }
    return (
        <Combobox
            items={found.codes}
            filter={null}
            autoHighlight
            value={value !== undefined && index.names.has(value) ? value : null}
            inputValue={draft.text}
            onInputValueChange={(text, { reason }) => {
                if (reason === 'input-change') {
                    setTyping(true)
                    draft.change(text)
                }
            }}
            onItemHighlighted={(code, { reason }) => {
                highlighted.current = reason === 'pointer' ? undefined : code
            }}
            onValueChange={(code, { reason }) => {
                if (code !== null) {
                    pick(code)
                } else if (reason === 'clear-press') {
                    pick('')
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
                showClear={!required && !readOnly}
                clearLabel={i18n.t('Clear')}
                onBlur={() => {
                    setTyping(false)
                    draft.commit()
                }}
                onKeyDown={(event) => {
                    const code =
                        typing &&
                        draft.text.trim() !== '' &&
                        highlighted.current !== undefined &&
                        found.codes.includes(highlighted.current)
                            ? highlighted.current
                            : undefined
                    if (event.key === 'Tab' && code !== undefined) {
                        draft.change(code)
                    } else if (
                        event.key === 'Enter' &&
                        code === undefined &&
                        !composing(event)
                    ) {
                        draft.commit()
                    }
                }}
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
