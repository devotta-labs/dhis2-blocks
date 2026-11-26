import { createStore } from 'zustand/vanilla'
import { newEntryId } from '../core/entries'
import { createFold } from '../core/fold'
import { indexLayout } from '../core/layout'
import type { TallyEntry, TallyLayout } from '../core/types'

/** The largest count a cell is corrected to: six digits. */
export const MAX_COUNT = 999_999

export interface TallyStoreOptions {
    layout: TallyLayout
    /** The log the sheet opens on. */
    entries: readonly TallyEntry[]
    /**
     * Names this device on the entries it makes; its undo takes back only entries with this name. Without one the
     * sheet makes a name of its own, so undo reaches the entries made since it opened.
     */
    by?: string
    /** Every entry the sheet makes, as it makes them; the host adds them to the log it keeps. */
    onAppend?: (entries: readonly TallyEntry[]) => void
    newId?: () => string
    now?: () => string
}

/** A count typed over a cell: what it showed when editing began, and the number typed. */
export interface TallyCorrection {
    cell: number
    sumBefore: number
    count: number
}

export interface TallyState {
    /** Each cell's count, by cell number; never below zero. */
    counts: readonly number[]
    rowTotals: readonly number[]
    total: number
    canUndo: boolean
    /** Counts the times the host's log replaced everything; counts typed before one no longer apply. */
    replaced: number
    /** Adds one to a cell. Closed cells take no taps. Returns the cell's new count. */
    tap(cell: number): number | undefined
    /** Takes back the latest tap or set of corrections with anything left. Returns the cells it changed. */
    undo(): readonly number[]
    /** Brings each cell to its typed count, keeping any taps made since editing began. Returns how many changed. */
    correct(corrections: readonly TallyCorrection[]): number
    /** Each cell's count now, for a correction to start from. */
    sums(): readonly number[]
    /**
     * Takes the host's log. One that holds every entry of the last log given adds what is new, wherever it sits, and
     * keeps the entries made here that the host has not handed back yet. A log with an entry missing is another
     * session: it replaces everything.
     */
    receive(entries: readonly TallyEntry[]): void
}

const continues = (
    last: readonly TallyEntry[],
    next: readonly TallyEntry[]
) => {
    if (next.length < last.length) return false
    return last.every(
        (entry, at) => entry === next[at] || entry.id === next[at]?.id
    )
}

const A_MILLISECOND = 1

/**
 * The session's counts, kept as entries are made and received, so a tap's own work does not grow with the log. A host
 * that keeps the log and hands it back has each earlier entry compared once, to tell a longer log from another one.
 */
export const createTallyStore = ({
    layout,
    entries,
    by: named,
    onAppend,
    newId = newEntryId,
    now = () => new Date().toISOString(),
}: TallyStoreOptions) => {
    const index = indexLayout(layout)
    const by = named ?? newId()
    let fold = createFold(index)
    let received = entries
    let receivedIds = new Set(entries.map(({ id }) => id))
    let replaced = 0
    let lastAt = 0
    fold.take(entries)

    const read = () => ({
        counts: fold.counts(),
        rowTotals: fold.rowTotals(),
        total: fold.total(),
        canUndo: fold.latest(by).length > 0,
        replaced,
    })

    return createStore<TallyState>()((set) => {
        const append = (made: readonly TallyEntry[]) => {
            if (made.length === 0) return
            fold.take(made)
            set(read())
            onAppend?.(made)
        }
        const stamp = () => {
            const instant = Date.parse(now())
            const after = Math.max(lastAt, fold.newest()) + A_MILLISECOND
            lastAt = Number.isNaN(instant) ? after : Math.max(instant, after)
            return { id: newId(), at: new Date(lastAt).toISOString(), by }
        }

        return {
            ...read(),
            tap(cell) {
                const row = index.rows[Math.floor(cell / index.columns.length)]
                const column = index.columns[cell % index.columns.length]
                if (!row || !column || index.isClosed(cell)) return undefined
                const place = { row: row.id, options: column.options }
                append([{ ...stamp(), kind: 'tap', ...place }])
                return fold.countOf(cell)
            },
            undo() {
                const latest = fold.latest(by)
                append(
                    latest.map(({ id }) => ({
                        ...stamp(),
                        kind: 'undo',
                        undoes: id,
                    }))
                )
                return [...new Set(latest.map(({ cell }) => cell))]
            },
            correct(corrections) {
                const batch = newId()
                const made = corrections.flatMap(
                    ({ cell, sumBefore, count }) => {
                        const row =
                            index.rows[Math.floor(cell / index.columns.length)]
                        const column =
                            index.columns[cell % index.columns.length]
                        const typed = Math.min(
                            MAX_COUNT,
                            Math.max(0, Math.trunc(count))
                        )
                        if (
                            !row ||
                            !column ||
                            !Number.isFinite(count) ||
                            typed === sumBefore
                        ) {
                            return []
                        }
                        return [
                            {
                                ...stamp(),
                                batch,
                                kind: 'correction',
                                row: row.id,
                                options: column.options,
                                delta: typed - sumBefore,
                            } satisfies TallyEntry,
                        ]
                    }
                )
                append(made)
                return made.length
            },
            sums: () => fold.counts(),
            receive(next) {
                if (next === received) return
                if (continues(received, next)) {
                    const added = next.slice(received.length)
                    for (const { id } of added) receivedIds.add(id)
                    fold.take(added)
                } else {
                    const ids = new Set(next.map(({ id }) => id))
                    const holdsAll = [...receivedIds].every((id) => ids.has(id))
                    if (!holdsAll) {
                        fold = createFold(index)
                        replaced += 1
                    }
                    fold.take(next)
                    receivedIds = ids
                }
                received = next
                set(read())
            },
        }
    })
}

export type TallyStore = ReturnType<typeof createTallyStore>
