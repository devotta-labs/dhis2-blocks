import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef, useState } from 'react'
import { Input } from '@/components/dhis2/ui/input'
import type { DataEngine } from '../../sources/types'
import { formatCount, matchCount, useAnnounced } from '../OptionCell'
import { OptionList } from '../OptionList'
import type { PopupEditorProps } from '../popupEditors'
import { composing } from '../useCellMode'
import { EditorButtons, saveOnCtrlEnter } from './EditorButtons'

// Fewer characters match too much to be worth asking the server.
const MIN_LENGTH = 2
// A word typed in one go is searched once, when typing stops.
const DEBOUNCE_MS = 250
const NO_RESULTS: ReadonlyArray<SearchResult> = []

/** A result of a search: the value it saves, and how the list shows it. */
interface SearchResult {
    value: string
    name: string
    /** Shown under the name. */
    detail: string
}

interface SearchAnswer {
    results: ReadonlyArray<SearchResult>
    /** How many match; more than the results when the server sent only some. */
    total: number
}

interface SearchEditorProps extends PopupEditorProps {
    /** The stored value as the cell shows it, which the search field starts with. */
    shown: string
    /** The search field's name. */
    label: string
    /** Said when a search finds nothing. */
    none: string
    search(
        engine: DataEngine,
        query: string,
        signal: AbortSignal
    ): Promise<SearchAnswer>
    /** Told of a result as it is saved, before the cell shows it. */
    onPick?(result: SearchResult): void
}

interface Found extends SearchAnswer {
    query: string
    problem?: string
}

/**
 * A value found on the server: typing searches, from two characters on and once typing stops, and lists the results,
 * the first highlighted. ↑ and ↓ move the highlight; Enter or a click saves a result, and Save, Ctrl+Enter or ⌘+Enter
 * saves the highlighted one; while a search waits for its answer they do nothing. The field starts on the stored value:
 * emptied, Save or leaving the editor clears the value; leaving never saves a result that was not picked. Each answer is
 * announced: how many it lists, or that it found none, or why the search failed.
 */
export const SearchEditor = ({
    value,
    cellId,
    labelledBy,
    firstKey,
    save,
    report,
    cancel,
    shown,
    label,
    none,
    search,
    onPick,
}: SearchEditorProps) => {
    const engine = useDataEngine()
    const [text, setText] = useState(firstKey ?? shown)
    // Only what was typed is searched, not the stored value the field starts with.
    const [typed, setTyped] = useState(firstKey !== undefined)
    const [found, setFound] = useState<Found>()
    const [active, setActive] = useState(0)
    const field = useRef<HTMLInputElement>(null)
    const query = typed ? text.trim() : ''
    // Only the answer for what the field holds now is listed, so Enter never picks from an older one.
    const fresh = found?.query === query ? found : undefined
    const results = fresh?.results ?? NO_RESULTS
    const highlighted = results[active]
    const listId = `${cellId}-results`
    const optionId = (code: string) => `${listId}-${encodeURIComponent(code)}`
    const names = new Map(
        results.map(({ value: code, name, detail }) => [
            code,
            <>
                {name}
                <span className="block text-xs text-dhis2-grey-700">
                    {detail}
                </span>
            </>,
        ])
    )
    const count =
        fresh === undefined ? '' : matchCount(results.length, fresh.total)
    const message =
        fresh?.problem ??
        (fresh !== undefined && results.length === 0 ? none : undefined)
    // The answer for what the field holds is still to come.
    const waiting = query.length >= MIN_LENGTH && fresh === undefined
    const said =
        message ??
        (count === ''
            ? i18n.t('Results: {{results}}', {
                  nsSeparator: '::',
                  results: formatCount(results.length),
              })
            : count)
    // Said as each answer arrives: while a search waits there is nothing to say, so the same news is heard again.
    useAnnounced(fresh === undefined ? '' : said)

    useEffect(() => {
        const input = field.current
        input?.focus()
        // The stored value is replaced by what is typed; typed text is added to.
        if (firstKey === undefined) {
            input?.select()
        }
    }, [])
    useEffect(() => {
        if (query.length < MIN_LENGTH) {
            return undefined
        }
        const controller = new AbortController()
        const timer = setTimeout(() => {
            search(engine, query, controller.signal).then(
                (answer) => {
                    if (!controller.signal.aborted) {
                        setFound({ query, ...answer })
                        setActive(0)
                    }
                },
                (error: Error) => {
                    if (!controller.signal.aborted) {
                        setFound({
                            query,
                            results: [],
                            total: 0,
                            problem:
                                error instanceof FetchError &&
                                error.type === 'network'
                                    ? i18n.t('You are offline')
                                    : i18n.t('Could not search. Try again.'),
                        })
                    }
                }
            )
        }, DEBOUNCE_MS)
        return () => {
            clearTimeout(timer)
            controller.abort()
        }
    }, [query])

    const pick = (result: SearchResult) => {
        onPick?.(result)
        save(result.value)
    }
    /** What the field saves without a pick: nothing once emptied, else the stored value. */
    const kept = (next: string) => (next.trim() === '' ? null : (value ?? null))
    const commit = () => {
        if (waiting) {
            return
        }
        if (highlighted === undefined) {
            save(kept(text))
        } else {
            pick(highlighted)
        }
    }
    const saveOnCtrl = saveOnCtrlEnter(commit)
    const note =
        message === undefined ? null : (
            <p
                className={
                    fresh?.problem === undefined
                        ? 'text-dhis2-grey-700'
                        : 'text-xs text-dhis2-red-700'
                }
            >
                {message}
            </p>
        )
    return (
        <>
            <Input
                ref={field}
                type="search"
                role="combobox"
                aria-label={label}
                placeholder={label}
                aria-autocomplete="list"
                aria-expanded={results.length > 0}
                aria-controls={results.length > 0 ? listId : undefined}
                aria-activedescendant={
                    highlighted === undefined
                        ? undefined
                        : optionId(highlighted.value)
                }
                autoComplete="off"
                spellCheck={false}
                value={text}
                onChange={({ target }) => {
                    setText(target.value)
                    setTyped(true)
                    report(kept(target.value))
                }}
                onKeyDown={(event) => {
                    saveOnCtrl(event)
                    if (
                        event.defaultPrevented ||
                        composing(event) ||
                        results.length === 0
                    ) {
                        return
                    }
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault()
                        const step = event.key === 'ArrowDown' ? 1 : -1
                        setActive(
                            Math.max(
                                0,
                                Math.min(active + step, results.length - 1)
                            )
                        )
                    } else if (
                        event.key === 'Enter' &&
                        highlighted !== undefined
                    ) {
                        event.preventDefault()
                        pick(highlighted)
                    }
                }}
                className="h-(--dhis2-field-height-dense)"
            />
            {results.length > 0 ? (
                <OptionList
                    inline
                    id={listId}
                    labelledBy={labelledBy}
                    codes={results.map((result) => result.value)}
                    names={names}
                    count={count}
                    active={active}
                    optionId={optionId}
                    onPick={(code) => {
                        const result = results.find(
                            (each) => each.value === code
                        )
                        if (result !== undefined) {
                            pick(result)
                        }
                    }}
                />
            ) : (
                note
            )}
            <EditorButtons save={commit} cancel={cancel} />
        </>
    )
}
