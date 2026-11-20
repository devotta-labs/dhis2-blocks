import { useDhis2ConnectionStatus } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useRef, useState } from 'react'
import type { Field } from '@/components/dhis2-value-types'
import { FieldDescription } from '@/components/dhis2/ui/field'
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
import { MIN_LENGTH, searchFor, useServerSearch } from '../search/serverSearch'
import { useReported } from '../useReported'

/** How a stored id whose name is not known is shown. */
export const unknownName = (id: string) =>
    i18n.t('Unknown ({{id}})', { id, interpolation: { escapeValue: false } })

/**
 * An org unit or username searched on the server, from two characters on: a pick is reported at once, and the field
 * shows its name. Typing highlights the top result, which Enter or Tab picks; while the search for the typed text is
 * still to answer, Enter waits for it and Tab leaves the field with its value. Emptied and left, or Enter, it reports no
 * value; other typing is dropped when the field is left. Unless required, a value has a clear button in the input.
 * Offline it says it needs a connection, and does not search.
 */
export const SearchInput = ({
    id,
    field,
    value,
    valueName,
    required,
    onChange,
}: {
    id: string
    field: Field
    value: string | undefined
    valueName: string | undefined
    required: boolean
    onChange(value: string | null): void
}) => {
    const server = searchFor(field.valueType)
    const { isDisconnected } = useDhis2ConnectionStatus()
    const [typed, setTyped] = useState<string | null>(null)
    const echo = useReported(value)
    if (echo.isNew) {
        setTyped(null)
    }
    const report = (next: string | null) => {
        echo.report(next)
        onChange(next)
    }
    const [picked, setPicked] = useState<{ value: string; name: string }>()
    const query = typed === null || isDisconnected ? '' : typed.trim()
    const found = useServerSearch(server?.search, query)
    const waiting = query.length >= MIN_LENGTH && found === undefined
    const highlighted = useRef<string>()
    const results = new Map(
        found?.results.map((result) => [result.value, result])
    )
    const disconnected = i18n.t('Connect to the internet to search')
    let none = ''
    if (isDisconnected) {
        none = disconnected
    } else if (found !== undefined) {
        none = found.problem ?? (results.size === 0 ? (server?.none ?? '') : '')
    } else if (query.length < MIN_LENGTH) {
        none = i18n.t('Type two or more characters to search')
    } else {
        none = i18n.t('Searching…')
    }
    useAnnounced(
        found === undefined ? '' : none || matchCount(results.size, found.total)
    )

    const name = picked?.value === value ? picked?.name : valueName
    const shown = value === undefined ? '' : (name ?? unknownName(value))
    const leave = () => {
        if (typed?.trim() === '' && value !== undefined) {
            report(null)
        }
        setTyped(null)
    }
    const pick = (result: { value: string; name: string }) => {
        setPicked(result)
        setTyped(null)
        report(result.value)
    }
    return (
        <>
            <Combobox
                items={[...results.keys()]}
                filter={null}
                autoHighlight
                value={value ?? null}
                inputValue={typed ?? shown}
                onInputValueChange={(text, { reason }) => {
                    if (reason === 'input-change') {
                        setTyped(text)
                    }
                }}
                onItemHighlighted={(each, { reason }) => {
                    highlighted.current =
                        reason === 'pointer' ? undefined : each
                }}
                onValueChange={(next, { reason }) => {
                    const result = next === null ? undefined : results.get(next)
                    if (result !== undefined) {
                        pick(result)
                    } else if (reason === 'clear-press') {
                        setTyped(null)
                        report(null)
                    }
                }}
                itemToStringLabel={(each) => results.get(each)?.name ?? shown}
            >
                <ComboboxInput
                    id={id}
                    autoComplete="off"
                    spellCheck={false}
                    aria-required={required || undefined}
                    showClear={!required}
                    clearLabel={i18n.t('Clear')}
                    onBlur={leave}
                    onKeyDown={(event) => {
                        if (
                            (event.key !== 'Enter' && event.key !== 'Tab') ||
                            composing(event)
                        ) {
                            return
                        }
                        if (waiting) {
                            if (event.key === 'Enter') {
                                event.preventDefault()
                                event.preventBaseUIHandler()
                            }
                            return
                        }
                        const result =
                            typed !== null &&
                            typed.trim() !== '' &&
                            highlighted.current !== undefined
                                ? results.get(highlighted.current)
                                : undefined
                        if (event.key === 'Tab' && result !== undefined) {
                            pick(result)
                        } else if (
                            event.key === 'Enter' &&
                            typed?.trim() === ''
                        ) {
                            leave()
                        }
                    }}
                />
                <ComboboxContent>
                    <ComboboxEmpty>{none}</ComboboxEmpty>
                    <ComboboxList>
                        {(each: string) => (
                            <ComboboxItem key={each} value={each}>
                                <span>
                                    {results.get(each)?.name}
                                    <span className="block text-xs text-dhis2-muted-foreground">
                                        {results.get(each)?.detail}
                                    </span>
                                </span>
                            </ComboboxItem>
                        )}
                    </ComboboxList>
                </ComboboxContent>
            </Combobox>
            {isDisconnected ? (
                <FieldDescription>{disconnected}</FieldDescription>
            ) : null}
        </>
    )
}
