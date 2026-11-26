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

/** A count typed over a cell: what it showed and summed to when editing began, and the number typed. */
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
    /** Each cell's sum as the log has it, for a correction to start from. */
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

const BETWEEN = '\u001F'
const A_MILLISECOND = 1

/** The session's counts, kept as entries are made and received, so a tap costs the same however long the log is. */
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
    for (const entry of entries) {
        const instant = entry.by === by ? Date.parse(entry.at) : Number.NaN
        if (instant > lastAt) lastAt = instant
    }
    fold.take(entries)

    const read = () => ({
        counts: fold.sums().map((sum) => Math.max(0, sum)),
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
            lastAt = Number.isNaN(instant)
                ? lastAt + A_MILLISECOND
                : Math.max(instant, lastAt + A_MILLISECOND)
            return { id: newId(), at: new Date(lastAt).toISOString(), by }
        }

        return {
            ...read(),
            tap(cell) {
                const row = index.rows[Math.floor(cell / index.columns.length)]
                const column = index.columns[cell % index.columns.length]
                if (!row || !column || index.isClosed(cell)) return undefined
                const place = { row: row.id, options: column.options }
                const sum = fold.sumOf(cell)
                if (sum >= 0) {
                    append([{ ...stamp(), kind: 'tap', ...place }])
                    return sum + 1
                }
                const settled = [
                    'settle',
                    row.id,
                    column.key,
                    fold.touchesOf(cell),
                    sum,
                ].join(BETWEEN)
                append([
                    {
                        ...stamp(),
                        id: settled,
                        kind: 'settle',
                        ...place,
                        delta: -sum,
                    },
                    { ...stamp(), kind: 'tap', ...place },
                ])
                return 1
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
                            typed === Math.max(0, sumBefore)
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
            sums: () => fold.sums(),
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
