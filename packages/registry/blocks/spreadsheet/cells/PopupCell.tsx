import { useDataEngine } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { memo, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useStore } from 'zustand'
import { typedText } from '@/components/dhis2-value-types'
import type { Field } from '@/components/dhis2-value-types'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cn } from '@/components/dhis2/ui/cn'
import { Popover, PopoverContent } from '@/components/dhis2/ui/popover'
import type { CellKey, CellState } from '../model/types'
import { NO_NAMES, useSpreadsheetContext } from '../provider/context'
import type { SpreadsheetContext } from '../provider/context'
import type { CellComponent, ControlProps } from './cellProps'
import { useCellContext } from './CellStatus'
import { composing, editorFor } from '@/components/dhis2-value-input'
import type { EditorProblem, FileUploads } from '@/components/dhis2-value-input'
import { gridFileUploads } from './gridFileUploads'
import { CONTROL_CLASS, HIDDEN_CLASS, LOCKED_CLASS } from './TextCell'
import { READY_CLASS, useCellMode } from './useCellMode'

const FIRST_KEY_TYPES = new Set(['LONG_TEXT'])
const FILE_TYPES = new Set(['FILE_RESOURCE', 'IMAGE'])

const FOCUSABLE =
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

const AS_IS = { escapeValue: false }

const DATE: Field = { valueType: 'DATE' }

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

const headerText = (labelledBy: string) =>
    labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.textContent ?? '')
        .join(' ')
        .trim()

const storedFileUrl = (
    fileUrl: SpreadsheetContext['fileUrl'],
    key: CellKey,
    { value, base }: CellState,
    image: boolean
) => (value !== undefined && value === base ? fileUrl?.(key, image) : undefined)

interface Opened {
    name: string
    firstKey?: string
    uploads?: FileUploads
}

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
    const context = useSpreadsheetContext()
    const { store, settings, announce, fileNames, fileUrl, offline } = context
    const engine = useDataEngine()
    const { view } = useCellContext()
    const Editor = editorFor(field.valueType)
    const locked = readOnly !== undefined || Editor === undefined
    const file = FILE_TYPES.has(field.valueType)
    const name = useStore(file ? fileNames : NO_NAMES, ({ names }) =>
        view.value === undefined ? undefined : names.get(view.value)
    )
    const image =
        field.valueType === 'IMAGE' && !hidden
            ? storedFileUrl(fileUrl, cellKey, view, true)
            : undefined
    const [unloadable, setUnloadable] = useState<string>()
    const preview =
        image === undefined || image === unloadable
            ? undefined
            : `${image}?dimension=SMALL`
    const [opened, setOpened] = useState<Opened | null>(null)
    const session = useRef<Opened | null>(null)
    const reported = useRef<Report>()
    const inside = useRef<Event>()
    const restore = useRef(false)
    const saved = useRef(false)
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
    const close = () => {
        const back =
            document.activeElement?.closest('[data-cell-editor]') != null
        restore.current = back
        end()
        return back
    }
    const leave = () => {
        restore.current = false
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
        const next = {
            name: headerText(labelledBy),
            firstKey,
            uploads: file
                ? gridFileUploads(cellKey, { ...context, engine })
                : undefined,
        }
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

    useEffect(() => {
        if (opened !== null && readOnly !== undefined) {
            close()
            announce(readOnly)
        }
    })
    useEffect(() => {
        if (opened === null) {
            return undefined
        }
        const sent = (event: Event) => {
            if (event !== inside.current) {
                leave()
            }
        }
        document.addEventListener('focusin', sent)
        return () => document.removeEventListener('focusin', sent)
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

    const loop = (event: KeyboardEvent<HTMLElement>) => {
        if (event.key !== 'Tab' || composing(event)) {
            return
        }
        const fields = Array.from(
            event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)
        ).filter((field) => field.getClientRects().length > 0)
        const at = fields.findIndex((element) => element === event.target)
        const last = fields.length - 1
        if (
            fields.length > 0 &&
            (event.shiftKey ? at <= 0 : at === -1 || at === last)
        ) {
            event.preventDefault()
            fields[event.shiftKey ? last : 0].focus({ preventScroll: true })
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
        })
    }
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
                inputMode="none"
                autoComplete="off"
                spellCheck={false}
                value={shown}
                onChange={() => undefined}
                onKeyDown={onKeyDown}
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
                    alt=""
                    loading="lazy"
                    onError={() => setUnloadable(image)}
                    className="pointer-events-none absolute start-2 top-1/2 size-6 -translate-y-1/2 rounded-dhis2-sm object-cover"
                />
            )}
            {opened === null || Editor === undefined ? null : (
                <Popover
                    open
                    modal={false}
                    onOpenChange={(_, { reason, event }) => {
                        if (reason === 'escape-key') {
                            if (
                                !event.defaultPrevented &&
                                !(
                                    event instanceof globalThis.KeyboardEvent &&
                                    (event.isComposing || event.keyCode === 229)
                                )
                            ) {
                                close()
                            }
                        } else if (
                            (reason === 'outside-press' ||
                                reason === 'focus-out') &&
                            event !== inside.current
                        ) {
                            leave()
                        }
                    }}
                >
                    <PopoverContent
                        anchor={inputProps.ref}
                        align="start"
                        data-cell-editor=""
                        onKeyDown={loop}
                        finalFocus={() =>
                            restore.current && inputProps.ref.current
                        }
                        aria-label={i18n.t('Edit {{field}}', {
                            field: opened.name,
                            interpolation: AS_IS,
                        })}
                        onPointerDownCapture={(event) => {
                            inside.current = event.nativeEvent
                        }}
                        onFocusCapture={(event) => {
                            inside.current = event.nativeEvent
                        }}
                        className="w-max max-w-[min(30rem,90vw)] min-w-(--anchor-width) gap-3 rounded-dhis2-sm border border-dhis2-border p-3"
                    >
                        <Editor
                            field={field}
                            value={view.value}
                            settings={settings}
                            cellId={id}
                            cellKey={cellKey}
                            announce={announce}
                            labelledBy={labelledBy}
                            hiddenOptions={view.effects.hiddenOptions}
                            save={save}
                            report={(value, problem) => {
                                reported.current = { value, problem }
                            }}
                            cancel={close}
                            firstKey={opened.firstKey}
                            fileName={name}
                            fileUrl={
                                file
                                    ? storedFileUrl(
                                          fileUrl,
                                          cellKey,
                                          view,
                                          field.valueType === 'IMAGE'
                                      )
                                    : undefined
                            }
                            offline={offline}
                            uploads={opened.uploads}
                        />
                    </PopoverContent>
                </Popover>
            )}
        </>
    )
}) satisfies CellComponent
