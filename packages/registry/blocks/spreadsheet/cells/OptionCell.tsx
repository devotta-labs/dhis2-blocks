import i18n from '@dhis2/d2-i18n'
import { memo, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import {
    composing,
    formatCount,
    matchCount,
    MIN_LENGTH,
    searchFor,
    useAnnounced,
    useServerSearch,
} from '@/components/dhis2-value-input'
import type { Found } from '@/components/dhis2-value-input'
import {
    optionIndex,
    searchOptions,
    typedText,
} from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { NO_NAMES, useSpreadsheetContext } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
import { useCellContext } from './CellStatus'
import { OptionList } from './OptionList'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { addsRow, READY_CLASS, useCellMode } from './useCellMode'

const NO_OPTIONS: ReadonlyArray<Option> = []
const NO_MATCHES = {
    codes: [],
    total: 0,
    names: new Map<string, ReactNode>(),
}

const searchNews = (found: Found, none: string, count: string) => {
    if (found.problem !== undefined) {
        return found.problem
    }
    if (found.results.length === 0) {
        return none
    }
    return count === ''
        ? i18n.t('Results: {{results}}', {
              nsSeparator: '::',
              results: formatCount(found.results.length),
          })
        : count
}

/**
 * An option set's field: the option's name in one input, and typing lists the matches to pick from. Only the cell
 * being typed in searches and draws a list, so a grid of option cells costs what one of text cells does. Typed text
 * that is no option is saved like any cell's and refused with its error. `quickKeys` are keys that, in Ready, save
 * their text at once instead of starting a search.
 *
 * An org unit or username field (the `search` kind) lists what the server finds instead, from two characters on and
 * once typing stops, each result with its path or username under its name. It saves only a result that was picked, or
 * no value once emptied; other typing is dropped when the cell is left. An org unit cell shows the org unit's name.
 */
export const OptionCell = memo(function OptionCell({
    id,
    cellKey,
    field,
    labelledBy,
    move,
    readOnly,
    hidden = false,
    aria,
    quickKeys,
}: ControlProps & { quickKeys?: ReadonlyMap<string, string> }) {
    const { store, settings, orgUnitNames, announce } = useSpreadsheetContext()
    const { view } = useCellContext()
    const server = searchFor(field.valueType)
    const searching = server !== undefined
    const orgUnit = field.valueType === 'ORGANISATION_UNIT'
    const name = useStore(orgUnit ? orgUnitNames : NO_NAMES, ({ names }) =>
        view.value === undefined ? undefined : names.get(view.value)
    )
    const [draft, setDraft] = useState<string | null>(null)
    const [listing, setListing] = useState(false)
    const [active, setActive] = useState(0)
    const locked = readOnly !== undefined
    const open = listing && !locked
    const options = field.options ?? NO_OPTIONS
    const hiddenOptions = view.effects.hiddenOptions
    const offered = useMemo(
        () =>
            open && hiddenOptions !== undefined
                ? options.filter(({ code }) => !hiddenOptions.has(code))
                : options,
        [open, options, hiddenOptions]
    )
    const query = open && searching && draft !== null ? draft.trim() : ''
    const found = useServerSearch(server?.search, query)
    const waiting = query.length >= MIN_LENGTH && found === undefined
    const matches = useMemo(() => {
        if (!open || (searching && found === undefined)) {
            return NO_MATCHES
        }
        if (found !== undefined) {
            return {
                codes: found.results.map(({ value }) => value),
                total: found.total,
                names: new Map<string, ReactNode>(
                    found.results.map(({ value, name: shown, detail }) => [
                        value,
                        <>
                            {shown}
                            <span className="block text-xs text-dhis2-muted-foreground">
                                {detail}
                            </span>
                        </>,
                    ])
                ),
            }
        }
        const index = optionIndex(offered)
        return { ...searchOptions(index, draft ?? ''), names: index.names }
    }, [open, searching, found, offered, draft])
    const listed = matches.codes.length > 0
    const highlighted = Math.min(active, matches.codes.length - 1)
    const listId = `${id}-options`
    const optionId = (code: string) => `${listId}-${encodeURIComponent(code)}`
    const count = matchCount(matches.codes.length, matches.total)
    const note =
        found !== undefined && !listed && server !== undefined
            ? searchNews(found, server.none, count)
            : undefined
    const news = () => {
        if (server === undefined) {
            return open && !listed ? i18n.t('No matches') : count
        }
        return found === undefined ? '' : searchNews(found, server.none, count)
    }
    useAnnounced(news(), announce)

    const close = () => {
        setListing(false)
        setDraft(null)
    }
    const commit = (text: string) => (locked ? undefined : view.commit(text))
    const save = (text: string | null) => {
        close()
        return text === null || (searching && text.trim() !== '')
            ? undefined
            : commit(text)
    }
    const choose = (code: string) => {
        close()
        const result = found?.results.find(({ value }) => value === code)
        if (orgUnit && result !== undefined) {
            orgUnitNames.setState(({ names }) => ({
                names: new Map(names).set(code, result.name),
            }))
        }
        return commit(code)
    }
    const revert = () => {
        setListing(false)
        setDraft(null)
        if (!locked && view.draft !== undefined) {
            store.getState().discardDraft(cellKey)
        }
    }
    const { mode, typed, ready, inputProps } = useCellMode({
        commit: () => save(draft),
        revert,
        move,
        readOnly: locked,
    })
    const pick = (code: string) => {
        choose(code)
        ready()
    }
    const list = (first: 0 | -1) => {
        setListing(true)
        setActive(first)
    }
    const stored =
        view.value === undefined
            ? ''
            : (name ?? typedText(field, view.value, settings))
    const entered = locked ? stored : (draft ?? view.draft ?? stored)
    const shown = hidden ? i18n.t('Hidden') : entered
    return (
        <>
            <input
                {...inputProps}
                {...aria}
                id={id}
                aria-labelledby={labelledBy}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={listed}
                aria-controls={listed ? listId : undefined}
                aria-activedescendant={
                    listed && highlighted >= 0
                        ? optionId(matches.codes[highlighted])
                        : undefined
                }
                type="text"
                readOnly={locked}
                autoComplete="off"
                spellCheck={false}
                value={shown}
                onChange={(event) => {
                    setDraft(event.target.value)
                    list(event.target.value.trim() === '' ? -1 : 0)
                    typed()
                }}
                onBlur={() => save(draft)}
                onMouseDown={(event) => {
                    const selected =
                        event.currentTarget.ownerDocument.activeElement ===
                        event.currentTarget
                    inputProps.onMouseDown(event)
                    if (!locked && selected && !listing) {
                        list(-1)
                    }
                }}
                onKeyDown={(event) => {
                    const quick =
                        mode === 'ready' &&
                        !event.altKey &&
                        !event.ctrlKey &&
                        !event.metaKey &&
                        !composing(event)
                            ? quickKeys?.get(event.key.toLowerCase())
                            : undefined
                    if (quick !== undefined) {
                        event.preventDefault()
                        save(quick)
                        return
                    }
                    if (
                        !locked &&
                        !composing(event) &&
                        (event.key === 'F4' ||
                            (event.altKey && event.key === 'ArrowDown') ||
                            (mode === 'ready' &&
                                event.key === ' ' &&
                                !event.altKey &&
                                !event.ctrlKey &&
                                !event.metaKey))
                    ) {
                        event.preventDefault()
                        list(-1)
                        typed()
                        return
                    }
                    if (
                        waiting &&
                        (event.key === 'Enter' || event.key === 'Tab') &&
                        !composing(event)
                    ) {
                        event.preventDefault()
                        return
                    }
                    if (listed && !composing(event)) {
                        if (
                            event.key === 'ArrowDown' ||
                            event.key === 'ArrowUp'
                        ) {
                            event.preventDefault()
                            const step = event.key === 'ArrowDown' ? 1 : -1
                            setActive(
                                Math.max(
                                    0,
                                    Math.min(
                                        highlighted + step,
                                        matches.codes.length - 1
                                    )
                                )
                            )
                            return
                        }
                        if (event.key === 'Enter' && highlighted >= 0) {
                            if (!addsRow(event)) {
                                event.preventDefault()
                            }
                            pick(matches.codes[highlighted])
                            return
                        }
                        if (event.key === 'Tab' && highlighted >= 0) {
                            choose(matches.codes[highlighted])
                            if (!event.shiftKey) {
                                move('tab')
                            }
                            return
                        }
                    }
                    inputProps.onKeyDown(event)
                }}
                className={cn(
                    CONTROL_CLASS,
                    mode === 'ready' && READY_CLASS,
                    locked && LOCKED_CLASS,
                    hidden && HIDDEN_CLASS
                )}
            />
            {listed || note !== undefined ? (
                <OptionList
                    id={listId}
                    labelledBy={labelledBy}
                    codes={matches.codes}
                    names={matches.names}
                    count={note ?? count}
                    active={highlighted}
                    optionId={optionId}
                    onPick={pick}
                />
            ) : null}
        </>
    )
}) satisfies CellComponent
