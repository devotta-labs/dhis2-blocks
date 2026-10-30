import i18n from '@dhis2/d2-i18n'
import { memo, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStore } from 'zustand'
import {
    optionIndex,
    searchOptions,
    typedText,
} from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { NO_NAMES, useDataEntryContext } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
import { useCellContext } from './CellStatus'
import { OptionList } from './OptionList'
import { MIN_LENGTH, searchFor, useServerSearch } from './serverSearch'
import type { Found } from './serverSearch'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { addsRow, composing, READY_CLASS, useCellMode } from './useCellMode'

const NO_OPTIONS: ReadonlyArray<Option> = []
const NO_MATCHES = {
    codes: [],
    total: 0,
    names: new Map<string, ReactNode>(),
}

export const formatCount = (count: number) => {
    try {
        // DHIS2 writes locales as `en_US`; Intl expects `en-US`.
        return new Intl.NumberFormat(i18n.language.replace('_', '-')).format(
            count
        )
    } catch {
        // A locale Intl still cannot read.
        return String(count)
    }
}

/** "Showing … of … matches", when more match than a list draws; empty otherwise. */
export const matchCount = (shown: number, total: number) =>
    total > shown
        ? i18n.t('Showing {{shown}} of {{total}} matches', {
              shown: formatCount(shown),
              total: formatCount(total),
          })
        : ''

/** What a search's answer says: why it failed, that it found nothing, or how many it lists. */
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

/** Says `text` in the grid's live region when it changes, not on every keystroke. */
export const useAnnounced = (text: string) => {
    const { announce } = useDataEntryContext()
    useEffect(() => {
        if (text !== '') {
            announce(text)
        }
    }, [text, announce])
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
    const { store, settings, orgUnitNames } = useDataEntryContext()
    const { view } = useCellContext()
    const server = searchFor(field.valueType)
    const searching = server !== undefined
    const orgUnit = field.valueType === 'ORGANISATION_UNIT'
    // An org unit cell reads only its own name, so a new name renders no other cell.
    const name = useStore(orgUnit ? orgUnitNames : NO_NAMES, ({ names }) =>
        view.value === undefined ? undefined : names.get(view.value)
    )
    // What has been typed and not yet saved; `null` shows the cell's own text.
    const [draft, setDraft] = useState<string | null>(null)
    const [listing, setListing] = useState(false)
    const [active, setActive] = useState(0)
    const locked = readOnly !== undefined
    const open = listing && !locked
    const options = field.options ?? NO_OPTIONS
    const hiddenOptions = view.effects.hiddenOptions
    // Options a rule hid go before the search ranks and counts; the list is filtered once per opening.
    const offered = useMemo(
        () =>
            open && hiddenOptions !== undefined
                ? options.filter(({ code }) => !hiddenOptions.has(code))
                : options,
        [open, options, hiddenOptions]
    )
    // Only what was typed is searched, not the stored value.
    const query = open && searching && draft !== null ? draft.trim() : ''
    const found = useServerSearch(server?.search, query)
    // The answer for what the cell holds is still to come.
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
                            <span className="block text-xs text-dhis2-grey-700">
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
    // From the code, so a new top match is a new active option that a screen reader reads.
    const optionId = (code: string) => `${listId}-${encodeURIComponent(code)}`
    const count = matchCount(matches.codes.length, matches.total)
    // Why a search lists nothing, under the cell.
    const note =
        found !== undefined && !listed && server !== undefined
            ? searchNews(found, server.none, count)
            : undefined
    // A search's answer is said as it arrives: while one waits there is nothing to say, so the same news is heard again.
    const news = () => {
        if (server === undefined) {
            return open && !listed ? i18n.t('No matches') : count
        }
        return found === undefined ? '' : searchNews(found, server.none, count)
    }
    useAnnounced(news())

    const close = () => {
        setListing(false)
        setDraft(null)
    }
    // A rule can lock the cell while its text is being typed: the lock wins. Text in a cell a rule only hid is the
    // person's, saved, then cleared by the rule, which says so; `commit` reads the cell's lock as it saves.
    const commit = (text: string) =>
        locked && !hidden ? undefined : view.commit(text)
    const save = (text: string | null) => {
        close()
        // A search saves only what was picked, or no value once emptied.
        return text === null || (searching && text.trim() !== '')
            ? undefined
            : commit(text)
    }
    /** Saves an option or a result; a picked org unit's name is the cell's at once. */
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
    /** Typing highlights the top match for Enter to pick; a click highlights none, so Enter still moves on. */
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
                    // Emptied text highlights nothing, so Enter or Tab clears the cell.
                    list(event.target.value.trim() === '' ? -1 : 0)
                    typed()
                }}
                onBlur={() => save(draft)}
                onMouseDown={(event) => {
                    const selected =
                        event.currentTarget.ownerDocument.activeElement ===
                        event.currentTarget
                    inputProps.onMouseDown(event)
                    // Clicking the selected cell edits it and lists the options.
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
                        // Each key is its own action; `commit` refuses it if a rule has locked the cell.
                        event.preventDefault()
                        save(quick)
                        return
                    }
                    if (
                        !locked &&
                        !composing(event) &&
                        (event.key === 'F4' ||
                            (event.altKey && event.key === 'ArrowDown'))
                    ) {
                        // Every option, from the keyboard; as in Enter mode, Escape then closes the list.
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
                        // Nothing to pick yet: the search for what the cell holds has not answered.
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
                            // Picks and stays; the next Enter moves on. Ctrl+Enter picks, then the grid adds a row.
                            if (!addsRow(event)) {
                                event.preventDefault()
                            }
                            pick(matches.codes[highlighted])
                            return
                        }
                        if (event.key === 'Tab' && highlighted >= 0) {
                            // Picks, and leaves the move to the browser; the grid hears of a plain Tab.
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
