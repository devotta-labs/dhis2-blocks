import i18n from '@dhis2/d2-i18n'
import { memo, useEffect, useMemo, useState } from 'react'
import {
    optionIndex,
    searchOptions,
    typedText,
} from '@/components/dhis2-value-types'
import type { Option } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { useCellView, useDataEntryContext } from '../provider/context'
import { cellDomId } from './cellProps'
import type { CellComponent, ControlProps } from './cellProps'
import { CellStatus, describeCell } from './CellStatus'
import { OptionList } from './OptionList'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { composing, READY_CLASS, useCellMode } from './useCellMode'

const NO_OPTIONS: ReadonlyArray<Option> = []
const NO_MATCHES = {
    codes: [],
    total: 0,
    names: new Map<string, string>(),
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

/**
 * An option set's field: the option's name in one input, and typing lists the matches to pick from. Only the cell
 * being typed in searches and draws a list, so a grid of option cells costs what one of text cells does. Typed text
 * that is no option is saved like any cell's and refused with its error.
 */
export const OptionCell = memo(function OptionCell({
    cellKey,
    field,
    labelledBy,
    move,
    readOnly,
    hidden = false,
}: ControlProps) {
    const { store, settings, announce } = useDataEntryContext()
    const view = useCellView(cellKey)
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
    const matches = useMemo(() => {
        if (!open) {
            return NO_MATCHES
        }
        const index = optionIndex(offered)
        return { ...searchOptions(index, draft ?? ''), names: index.names }
    }, [open, offered, draft])
    const listed = matches.codes.length > 0
    const highlighted = Math.min(active, matches.codes.length - 1)
    const listId = `${cellDomId(cellKey)}-options`
    // From the code, so a new top match is a new active option that a screen reader reads.
    const optionId = (code: string) => `${listId}-${encodeURIComponent(code)}`
    const count =
        matches.total > matches.codes.length
            ? i18n.t(
                  'Showing {{shown}} of {{total}} matches. Keep typing to narrow them.',
                  {
                      shown: formatCount(matches.codes.length),
                      total: formatCount(matches.total),
                  }
              )
            : ''
    // Said in the grid's live region when it changes, not on every keystroke.
    const said = open && !listed ? i18n.t('No matches') : count
    useEffect(() => {
        if (said !== '') {
            announce(said)
        }
    }, [said, announce])

    const save = (text: string | null) => {
        setListing(false)
        setDraft(null)
        // A rule can lock the cell while its text is being typed: the lock wins. Text in a cell a rule hid is the
        // person's, saved, then cleared by the rule, which says so: it is never dropped unsaid.
        return text === null || (locked && !(hidden && text !== ''))
            ? undefined
            : store.getState().commit(cellKey, text)
    }
    const revert = () => {
        setListing(false)
        setDraft(null)
        if (!locked && view.draft !== undefined) {
            store.getState().discardDraft(cellKey)
        }
    }
    const { notes, aria } = describeCell(cellKey, view, readOnly)
    const { mode, notesDismissed, typed, ready, inputProps } = useCellMode({
        commit: () => save(draft),
        revert,
        move,
        readOnly: locked,
        hasNotes: notes.length > 0,
    })
    const pick = (code: string) => {
        save(code)
        ready()
    }
    /** Typing highlights the top match for Enter to pick; a click highlights none, so Enter still moves on. */
    const list = (first: 0 | -1) => {
        setListing(true)
        setActive(first)
    }
    const stored =
        view.value === undefined ? '' : typedText(field, view.value, settings)
    const shown = hidden
        ? i18n.t('Hidden')
        : locked
          ? stored
          : (draft ?? view.draft ?? stored)
    return (
        <div className="relative">
            <input
                {...inputProps}
                {...aria}
                id={cellDomId(cellKey)}
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
                    list(0)
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
                            // Picks and stays; the next Enter moves on.
                            event.preventDefault()
                            pick(matches.codes[highlighted])
                            return
                        }
                        if (event.key === 'Tab' && highlighted >= 0) {
                            // Picks, and leaves the move to the browser; the grid hears of a plain Tab.
                            save(matches.codes[highlighted])
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
            {listed ? (
                <OptionList
                    id={listId}
                    labelledBy={labelledBy}
                    codes={matches.codes}
                    names={matches.names}
                    count={count}
                    active={highlighted}
                    optionId={optionId}
                    onPick={pick}
                />
            ) : null}
            <CellStatus view={view} notes={notes} dismissed={notesDismissed} />
        </div>
    )
}) satisfies CellComponent
