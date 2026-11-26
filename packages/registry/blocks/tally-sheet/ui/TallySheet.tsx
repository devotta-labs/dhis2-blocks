import i18n from '@dhis2/d2-i18n'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { useStore } from 'zustand'
import { announce } from '@/components/dhis2/ui/announcer'
import { cn } from '@/components/dhis2/ui/cn'
import { indexLayout } from '../core/layout'
import type { TallyEntry, TallyLayout, TallyRow } from '../core/types'
import { createTallyStore } from '../store/store'
import type { TallyCorrection } from '../store/store'
import { TallyContext } from './context'
import type { EditSession, TallyContextValue } from './context'
import { groupIdsOf, headerLevels, rowSections, sheetIds } from './headers'
import { changedMessage, tappedMessage, undoneMessage } from './messages'
import { createSheetPointer } from './pointer'
import { TallyGrid } from './TallyGrid'
import { TallyEditButtons, TallyTotal, TallyUndoButton } from './TallyToolbar'

export interface TallySheetProps {
    /** The sheet as printed. Compared by content: a layout with other content starts the sheet again from the log. */
    layout: TallyLayout
    /** Names the grid's scroll region and the grid for screen readers. */
    label: string
    /** The session's log, when the host keeps it; every change to it is taken in. */
    entries?: readonly TallyEntry[]
    /** The log the sheet starts from when it keeps its own. */
    defaultEntries?: readonly TallyEntry[]
    /**
     * The entries each tap, undo or set of corrections adds, and only those. The only way entries leave the sheet:
     * without it they are kept in memory only.
     */
    onAppend?: (entries: readonly TallyEntry[]) => void
    /**
     * Names this device on its entries; undo takes back only entries with this name. Without it the sheet makes a
     * name when it opens. A new name starts the sheet again from the log.
     */
    by?: string
    editing?: boolean
    defaultEditing?: boolean
    onEditingChange?: (editing: boolean) => void
    /** Shown beside a row's label, such as an alert badge, with what the row adds up to. Keep it one component. */
    RowBadge?: ComponentType<{ row: TallyRow; total: number }>
    className?: string
    /** The parts, arranged; without any, the total and edit buttons, the grid, then the undo button. */
    children?: ReactNode
}

const focusFirst = (within: HTMLElement | null, selector: string) => {
    const target = within?.querySelector(selector)
    if (target instanceof HTMLElement) target.focus()
}

const buttonById = (id: string | undefined) => {
    const target = id === undefined ? null : document.getElementById(id)
    return target instanceof HTMLButtonElement ? target : undefined
}

/**
 * A tally sheet: one tap a mark, counted as it happens. "Edit counts" turns each cell into a number field, to put a
 * miscount right or copy a paper sheet in. The counts are read from an append-only log the host keeps or the sheet
 * keeps for itself.
 */
export const TallySheet = ({
    layout,
    label,
    entries,
    defaultEntries,
    onAppend,
    by,
    editing: editingProp,
    defaultEditing = false,
    onEditingChange,
    RowBadge,
    className,
    children,
}: TallySheetProps) => {
    const latest = useRef({ entries, onAppend, onEditingChange, RowBadge })
    latest.current = { entries, onAppend, onEditingChange, RowBadge }
    const content = JSON.stringify(layout)
    const sameLayout = useMemo(() => layout, [content])
    const own = useRef<TallyEntry[] | null>(null)
    own.current ??= [...(defaultEntries ?? [])]

    const sheet = useMemo(() => {
        const store = createTallyStore({
            layout: sameLayout,
            entries: latest.current.entries ?? [...(own.current ?? [])],
            by,
            onAppend: (made) => {
                if (latest.current.entries === undefined) {
                    own.current?.push(...made)
                }
                latest.current.onAppend?.(made)
            },
        })
        return {
            store,
            index: indexLayout(sameLayout),
            levels: headerLevels(sameLayout),
            sections: rowSections(sameLayout.rows),
            pointer: createSheetPointer(),
        }
    }, [sameLayout, by])
    const { store, index } = sheet
    const replaced = useStore(store, (state) => state.replaced)

    useEffect(() => {
        if (entries !== undefined) store.getState().receive(entries)
    }, [store, entries])

    const [ownEditing, setOwnEditing] = useState(defaultEditing)
    const editing = editingProp ?? ownEditing
    const controlled = editingProp !== undefined
    const setEditing = useCallback(
        (next: boolean) => {
            if (!controlled) setOwnEditing(next)
            latest.current.onEditingChange?.(next)
        },
        [controlled]
    )

    const [round, setRound] = useState(0)
    const session = useMemo(
        () =>
            editing
                ? ({
                      round: round + replaced,
                      sums: store.getState().sums(),
                      counts: store.getState().counts,
                      drafts: new Map<number, string>(),
                  } satisfies EditSession)
                : undefined,
        [editing, store, round, replaced]
    )

    const restoring = useRef(false)
    const finishEditing = useCallback(
        (save: boolean) => {
            if (save && session) {
                const corrections = [...session.drafts].flatMap(
                    ([cell, draft]) =>
                        draft === '' ||
                        Number(draft) === (session.counts[cell] ?? 0)
                            ? []
                            : [
                                  {
                                      cell,
                                      sumBefore: session.sums[cell] ?? 0,
                                      count: Number(draft),
                                  } satisfies TallyCorrection,
                              ]
                )
                announce(changedMessage(store.getState().correct(corrections)))
            }
            session?.drafts.clear()
            setRound((before) => before + 1)
            restoring.current = true
            setEditing(false)
        },
        [session, store, setEditing]
    )

    const tapCell = useCallback(
        (cell: number) => {
            const count = store.getState().tap(cell)
            if (count !== undefined) {
                announce(tappedMessage(index, cell, count))
            }
        },
        [store, index]
    )
    const adjustCell = useCallback(
        (cell: number, delta: number) => {
            const state = store.getState()
            const changed = state.correct([
                {
                    cell,
                    sumBefore: state.sums()[cell] ?? 0,
                    count: Math.max(0, (state.counts[cell] ?? 0) + delta),
                },
            ])
            if (changed > 0) {
                announce(
                    tappedMessage(
                        index,
                        cell,
                        store.getState().counts[cell] ?? 0
                    )
                )
            }
        },
        [store, index]
    )
    const undo = useCallback(() => {
        const cells = store.getState().undo()
        const said = undoneMessage(index, cells, store.getState().counts)
        if (said !== '') announce(said)
    }, [store, index])

    const scope = useId()
    const ids = useMemo(() => sheetIds(scope), [scope])
    const groupIds = useMemo(
        () => groupIdsOf(sheet.index.rows.length, sheet.sections, ids),
        [sheet, ids]
    )
    const [HostRowBadge] = useState(() => {
        const HostBadge = (props: { row: TallyRow; total: number }) => {
            const Own = latest.current.RowBadge
            return Own === undefined ? null : <Own {...props} />
        }
        return HostBadge
    })
    const hasRowBadge = RowBadge !== undefined
    const section = useRef<HTMLElement>(null)

    const shown = useRef({ store, replaced })
    useEffect(() => {
        const before = shown.current
        if (before.store === store && before.replaced === replaced) return
        shown.current = { store, replaced }
        if (editing) setEditing(false)
    }, [store, replaced, editing, setEditing])

    const wasEditing = useRef(editing)
    useEffect(() => {
        if (wasEditing.current === editing) return
        wasEditing.current = editing
        const { tabStop, field } = sheet.pointer.tabStop.getState()
        if (editing) {
            announce(i18n.t('Editing counts'))
            sheet.pointer.tabStop.setState({ field: undefined })
            const last =
                tabStop === undefined
                    ? null
                    : document.getElementById(ids.cell(tabStop))
            if (last instanceof HTMLInputElement) {
                last.focus()
            } else {
                focusFirst(section.current, 'input[data-cell]')
            }
            return
        }
        const lost =
            document.activeElement === null ||
            document.activeElement === document.body
        if (restoring.current || lost) {
            const target =
                buttonById(ids.edit) ??
                buttonById(field === undefined ? undefined : ids.cell(field)) ??
                buttonById(
                    tabStop === undefined ? undefined : ids.cell(tabStop)
                )
            if (target === undefined) {
                focusFirst(section.current, 'td button[tabindex="0"]')
            } else {
                target.focus()
            }
        }
        restoring.current = false
    }, [editing, ids, sheet])

    const value = useMemo(
        () =>
            ({
                ...sheet,
                layout: sameLayout,
                label,
                ids,
                groupIds,
                editing,
                session,
                setEditing,
                finishEditing,
                tapCell,
                adjustCell,
                undo,
                RowBadge: hasRowBadge ? HostRowBadge : undefined,
            }) satisfies TallyContextValue,
        [
            sheet,
            sameLayout,
            label,
            ids,
            groupIds,
            editing,
            session,
            setEditing,
            finishEditing,
            tapCell,
            adjustCell,
            undo,
            hasRowBadge,
            HostRowBadge,
        ]
    )

    return (
        <TallyContext.Provider value={value}>
            <section
                ref={section}
                data-slot="tally-sheet"
                className={cn('flex w-full min-w-0 flex-col gap-3', className)}
            >
                {children ?? (
                    <>
                        <div className="flex flex-wrap items-center gap-2 border-b border-dhis2-border pb-3">
                            <TallyTotal className="me-auto" />
                            <TallyEditButtons />
                        </div>
                        <TallyGrid />
                        <TallyUndoButton />
                    </>
                )}
            </section>
        </TallyContext.Provider>
    )
}
