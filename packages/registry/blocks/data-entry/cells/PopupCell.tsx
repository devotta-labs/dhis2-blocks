import { useConfig } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import { typedText } from '@/components/dhis2-value-types'
import type { Field } from '@/components/dhis2-value-types'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cn } from '@/components/dhis2/ui/cn'
import { useDataEntryContext } from '../provider/context'
import type { DataEntryContext } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
import { POPOVER_CLASS, useCellContext } from './CellStatus'
import { storedFileUrl } from './editors/FileEditor'
import { editorFor } from './popupEditors'
import type { EditorProblem } from './popupEditors'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { composing, READY_CLASS, useCellMode } from './useCellMode'

// Editors that start from the text typed to open them: the text itself, or a search.
const FIRST_KEY_TYPES = new Set(['LONG_TEXT', 'ORGANISATION_UNIT', 'USERNAME'])
// Values that are a file's id; the cell shows the file's name.
const FILE_TYPES = new Set(['FILE_RESOURCE', 'IMAGE'])

const FOCUSABLE =
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

/**
 * The editor's fields, in page order; a hidden one, such as the file editor's file input, takes no focus. Boxes, not
 * `checkVisibility`, which Safari lacks before 17.4.
 */
const fieldsOf = (box: HTMLElement) =>
    Array.from(box.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (field) => field.getClientRects().length > 0
    )

// The field's name is said as the page shows it, not HTML-escaped.
const AS_IS = { escapeValue: false }

// An age is stored as the date of birth, shown as dates are typed: in the system calendar and date format.
const DATE: Field = { valueType: 'DATE' }

// What cells that show no names read instead: it never changes, so it renders nothing again.
const NO_NAMES: DataEntryContext['orgUnitNames'] = createStore(() => ({
    names: new Map(),
}))

// What `formatDhis2Value` reads, made once per field: option sets can hold thousands of options.
const metas = new WeakMap<Field, ValueMeta>()
const metaOf = (field: Field) => {
    const known = metas.get(field)
    if (known !== undefined) {
        return known
    }
    const meta: ValueMeta = { valueType: field.valueType }
    if (field.options !== undefined) {
        meta.optionSet = {
            options: field.options.map(({ code, name }) => ({
                code,
                displayName: name,
            })),
        }
    }
    metas.set(field, meta)
    return meta
}

/** The text of the headers that name a cell, as the editor's name says it. */
const headerText = (labelledBy: string) =>
    labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()

interface Opened {
    name: string
    firstKey?: string
}

/** What the editor last said it would save. */
interface Report {
    value: string | null
    problem?: EditorProblem
}

/**
 * A value edited outside the cell: the cell shows it as DHIS2 displays it, and opens the value type's editor in a
 * small dialog under it (Enter, F2, F4, Alt+↓, a click on the selected cell, a double-click, or typing for editors
 * that start from text). Focus loops inside the dialog until a save, Escape or Cancel brings it back to the cell; a
 * save goes through the cell's `commit`, as typing does, and so does what the editor last reported when focus leaves
 * it, unless it cannot be saved: then the cell keeps it as its draft with the problem, as refused text. The editor
 * opens on the stored value. A value type without an editor, or a cell a rule locks or hides, stays read-only.
 */
export const PopupCell = memo(function PopupCell({
    id,
    cellKey,
    field,
    labelledBy,
    move,
    readOnly,
    hidden = false,
    aria,
}: ControlProps) {
    const { store, settings, announce, orgUnitNames, fileNames } =
        useDataEntryContext()
    const { baseUrl } = useConfig()
    const { view } = useCellContext()
    const Editor = editorFor(field.valueType)
    const locked = readOnly !== undefined || Editor === undefined
    const file = FILE_TYPES.has(field.valueType)
    const orgUnit = field.valueType === 'ORGANISATION_UNIT'
    const fileNameStore = file ? fileNames : NO_NAMES
    // Org unit and file cells show their value's name, each reading only its own, so a new name renders no other cell.
    const name = useStore(
        orgUnit ? orgUnitNames : fileNameStore,
        ({ names }) =>
            view.value === undefined ? undefined : names.get(view.value)
    )
    // A small preview of an image DHIS2 holds for the event, before its name; one that does not load leaves the name.
    const image =
        field.valueType === 'IMAGE' && !hidden
            ? storedFileUrl(baseUrl, cellKey, view, true)
            : undefined
    const [unloadable, setUnloadable] = useState<string>()
    const preview =
        image === undefined || image === unloadable
            ? undefined
            : `${image}?dimension=SMALL`
    const [opened, setOpened] = useState<Opened | null>(null)
    // The open session, read by saves that come late (an upload), so they close only their own.
    const session = useRef<Opened | null>(null)
    const reported = useRef<Report>()
    // The last event the dialog's own handlers saw; React carries the events of an editor's portals through them.
    const inside = useRef<Event>()
    const dialog = useRef<HTMLDivElement>(null)
    // Enter right after a save moves on, as it does after typing in any cell.
    const saved = useRef(false)
    // The cell is never typed in: it stays in Ready, and Escape drops a pasted text the store refused.
    const { inputProps } = useCellMode({
        commit: () => undefined,
        revert: () => {
            if (!locked && view.draft !== undefined) {
                store.getState().discardDraft(cellKey)
            }
        },
        move,
        readOnly: true,
    })
    const commit = (value: string | null) =>
        view.commit(value === null ? '' : typedText(field, value, settings))
    const end = () => {
        session.current = null
        reported.current = undefined
        setOpened(null)
    }
    /** Closes the editor unsaved; focus goes back to the cell if it was in the editor. Says whether it did. */
    const close = () => {
        const back = dialog.current?.contains(document.activeElement) ?? false
        end()
        if (back) {
            inputProps.ref.current?.focus()
        }
        return back
    }
    /** Focus left the editor for somewhere else: what it last reported is saved, or kept as the cell's draft. */
    const leave = () => {
        const last = reported.current
        end()
        if (last?.problem !== undefined) {
            store
                .getState()
                .keepDraft(cellKey, last.problem.text, last.problem.message)
        } else if (last !== undefined) {
            commit(last.value)
        }
    }
    const open = (firstKey?: string) => {
        const next = { name: headerText(labelledBy), firstKey }
        session.current = next
        reported.current = undefined
        setOpened(next)
    }
    const save = (value: string | null) => {
        const result = commit(value)
        if (session.current === opened) {
            saved.current = close()
        }
        return result
    }

    // A rule that locks or hides the cell closes its editor unsaved, and says why.
    useEffect(() => {
        if (opened !== null && readOnly !== undefined) {
            close()
            announce(readOnly)
        }
    })
    // Focus moves to the editor's first field, unless the editor focused one itself.
    useEffect(() => {
        const box = dialog.current
        if (box !== null && !box.contains(document.activeElement)) {
            ;(fieldsOf(box).at(0) ?? box).focus()
        }
    }, [opened])
    // A non-modal dialog: a press anywhere else, or focus sent elsewhere (a screen reader, a script), leaves it.
    useEffect(() => {
        if (opened === null) {
            return undefined
        }
        const outside = (event: Event) => {
            if (event !== inside.current) {
                leave()
            }
        }
        document.addEventListener('pointerdown', outside)
        document.addEventListener('focusin', outside)
        return () => {
            document.removeEventListener('pointerdown', outside)
            document.removeEventListener('focusin', outside)
        }
    }, [opened])

    const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
        const afterSave = saved.current
        saved.current = false
        if (locked || composing(event)) {
            inputProps.onKeyDown(event)
            return
        }
        const opens =
            event.key === 'F2' ||
            event.key === 'F4' ||
            (event.altKey && event.key === 'ArrowDown') ||
            (event.key === 'Enter' &&
                !afterSave &&
                !event.shiftKey &&
                !event.altKey &&
                !event.ctrlKey &&
                !event.metaKey)
        if (opens) {
            event.preventDefault()
            open()
        } else {
            inputProps.onKeyDown(event)
        }
    }

    // Tab and Shift+Tab loop over the editor's fields.
    const loop = (event: KeyboardEvent<HTMLDivElement>) => {
        const fields = fieldsOf(event.currentTarget)
        const at = fields.findIndex((element) => element === event.target)
        const last = fields.length - 1
        if (
            fields.length > 0 &&
            (event.shiftKey ? at <= 0 : at === -1 || at === last)
        ) {
            event.preventDefault()
            fields[event.shiftKey ? last : 0].focus()
        }
    }

    let stored: string
    if (file) {
        stored = name ?? view.value ?? ''
    } else if (field.valueType === 'AGE' && view.value !== undefined) {
        stored = typedText(DATE, view.value, settings)
    } else {
        stored = formatDhis2Value(view.value, metaOf(field), {
            calendar: settings.calendar,
            orgUnitNames:
                orgUnit && view.value !== undefined && name !== undefined
                    ? new Map([[view.value, name]])
                    : undefined,
        })
    }
    // One line in the input, which would drop line breaks and run the lines together.
    const shown = hidden
        ? i18n.t('Hidden')
        : ((locked ? undefined : view.draft) ?? stored).replace(/\r?\n/g, ' ')
    return (
        <>
            <input
                {...inputProps}
                {...aria}
                id={id}
                aria-labelledby={labelledBy}
                aria-haspopup={locked ? undefined : 'dialog'}
                type="text"
                readOnly={locked}
                // No on-screen keyboard: the editor takes the typing.
                inputMode="none"
                autoComplete="off"
                spellCheck={false}
                value={shown}
                // A cut or drop changes nothing: the cell shows its value again.
                onChange={() => undefined}
                onKeyDown={onKeyDown}
                // Text, however it is typed (a key, a dead key, AltGr, an input method), goes to the editor, not the cell.
                onBeforeInput={(event) => {
                    event.preventDefault()
                    if (!locked && FIRST_KEY_TYPES.has(field.valueType)) {
                        open(event.data)
                    }
                }}
                onMouseDown={(event) => {
                    const selected =
                        event.currentTarget.ownerDocument.activeElement ===
                        event.currentTarget
                    inputProps.onMouseDown(event)
                    // Clicking the selected cell edits it, as in any cell; a touch has no double-click.
                    if (selected && !locked) {
                        open()
                    }
                }}
                onDoubleClick={() => {
                    if (!locked) {
                        open()
                    }
                }}
                onBlur={() => {
                    saved.current = false
                }}
                className={cn(
                    CONTROL_CLASS,
                    READY_CLASS,
                    locked && LOCKED_CLASS,
                    hidden && HIDDEN_CLASS,
                    preview !== undefined && 'ps-10'
                )}
            />
            {preview === undefined ? null : (
                <img
                    src={preview}
                    // The cell says the file's name.
                    alt=""
                    loading="lazy"
                    onError={() => setUnloadable(image)}
                    className="pointer-events-none absolute start-2 top-1.5 size-6 rounded-dhis2-sm object-cover"
                />
            )}
            {opened === null || Editor === undefined ? null : (
                <div
                    ref={dialog}
                    role="dialog"
                    aria-label={i18n.t('Edit {{field}}', {
                        field: opened.name,
                        interpolation: AS_IS,
                    })}
                    // A click on the dialog's own background keeps focus in it.
                    tabIndex={-1}
                    onPointerDownCapture={(event) => {
                        inside.current = event.nativeEvent
                    }}
                    onFocusCapture={(event) => {
                        inside.current = event.nativeEvent
                    }}
                    onKeyDown={(event) => {
                        if (composing(event)) {
                            return
                        }
                        if (
                            event.key === 'Escape' &&
                            !event.nativeEvent.defaultPrevented
                        ) {
                            // Closes the editor, not the cell's notes.
                            event.preventDefault()
                            close()
                        } else if (event.key === 'Tab') {
                            loop(event)
                        }
                    }}
                    className={cn(
                        POPOVER_CLASS,
                        'z-50 flex w-max max-w-[min(30rem,90vw)] min-w-full flex-col gap-3 rounded-dhis2-sm border border-dhis2-grey-200 bg-dhis2-popover p-3 text-sm text-dhis2-popover-foreground shadow-dhis2-popover outline-none supports-[anchor-name:--a]:min-w-[anchor-size(width)]'
                    )}
                >
                    <Editor
                        field={field}
                        value={view.value}
                        settings={settings}
                        cellId={id}
                        cellKey={cellKey}
                        labelledBy={labelledBy}
                        hiddenOptions={view.effects.hiddenOptions}
                        save={save}
                        report={(value, problem) => {
                            reported.current = { value, problem }
                        }}
                        cancel={close}
                        firstKey={opened.firstKey}
                    />
                </div>
            )}
        </>
    )
}) satisfies CellComponent
