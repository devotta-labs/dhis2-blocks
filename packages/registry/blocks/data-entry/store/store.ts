import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import { checkStored, parseTyped } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import type {
    CellKey,
    CellState,
    CommitResult,
    GridTable,
    PendingChange,
    SyncState,
} from '../model/types'

export interface DataEntryStoreOptions {
    tables: ReadonlyArray<GridTable>
    values: ReadonlyMap<CellKey, string>
    settings: ValueSettings
    /** Called for every change that must be saved; the outbox writes it. */
    enqueue(key: CellKey, value: string | null, base: string | null): void
    /**
     * The translated message refusing one option code a person's value adds to the cell, or nothing. A multi-select's
     * value is checked code by code, and a code the cell already holds is not asked about; for any other field, a value
     * the cell already holds is not. Blank is never checked.
     */
    check?(key: CellKey, code: string): string | undefined
}

type Source = 'person' | 'rule'

export interface DataEntryState {
    /** Only cells that were loaded or touched have an entry; read the rest as `EMPTY_CELL`. */
    cells: Partial<Record<CellKey, CellState>>
    commit(key: CellKey, text: string, source?: Source): CommitResult
    /** Commits many cells in one store update; a person's commit is one undo step. */
    commitMany(
        entries: ReadonlyArray<{ key: CellKey; text: string }>,
        source?: Source
    ): CommitResult[]
    /** Drops a cell's draft and its error: nothing is enqueued and there is nothing to undo. */
    discardDraft(key: CellKey): void
    /**
     * Reverts the person's last commit (every cell of it), as new changes. Returns the cells it changed, in the order
     * they were committed; none when there was nothing to undo.
     */
    undo(): ReadonlyArray<CellKey>
    /**
     * Records what became of the values sent. A cell that has changed since keeps its newer change's
     * state; `saved` still moves its base to the value that was sent.
     */
    markSync(
        sent: ReadonlyArray<{ key: CellKey; value: string | null }>,
        sync: SyncState,
        reason?: string
    ): void
    /** Puts changes the outbox still holds back on their cells; nothing is enqueued. */
    restore(
        changes: ReadonlyArray<
            PendingChange & { sync?: SyncState; reason?: string }
        >
    ): void
}

/** What a cell with no entry reads as; one stable object. */
export const EMPTY_CELL: Readonly<CellState> = Object.freeze({
    sync: 'idle',
    source: 'person',
})

type Cells = DataEntryState['cells']

export const createDataEntryStore = ({
    tables,
    values,
    settings,
    enqueue,
    check,
}: DataEntryStoreOptions): StoreApi<DataEntryState> => {
    // A column id means the same field in every table.
    const fields = new Map<string, Field>(
        tables.flatMap((table) =>
            table.columns.map((column): [string, Field] => [
                column.id,
                column.field,
            ])
        )
    )
    const fieldOf = (key: CellKey) =>
        fields.get(key.slice(key.indexOf('.') + 1))
    /** What is wrong with a saved value, if anything; nothing is checked for a cell with no column. */
    const warningOf = (key: CellKey, value: string | undefined) => {
        const field = fieldOf(key)
        return field === undefined || value === undefined
            ? undefined
            : checkStored(field, value)?.message
    }

    /** What `check` says of the codes `value` adds to `held`; a code a person keeps is never refused. */
    const refusal = (
        key: CellKey,
        field: Field,
        held: string | undefined,
        value: string
    ) => {
        if (field.valueType !== 'MULTI_TEXT') {
            return value === held ? undefined : check?.(key, value)
        }
        const kept = new Set(held?.split(','))
        for (const code of value.split(',')) {
            const message = kept.has(code) ? undefined : check?.(key, code)
            if (message !== undefined) {
                return message
            }
        }
        return undefined
    }

    const loaded: Cells = {}
    for (const [key, value] of values) {
        loaded[key] = {
            base: value,
            value,
            warning: warningOf(key, value),
            sync: 'idle',
            source: 'person',
        }
    }

    return createStore<DataEntryState>()((set, get) => {
        // One entry per person's commit: the cells it changed and what each held before.
        const undoStack: Array<
            ReadonlyArray<{ key: CellKey; previous: string | undefined }>
        > = []

        /**
         * Runs `run` on the cells, copying them only once something is written, publishes the result in one
         * update, then enqueues what `run` queued, in order.
         */
        const edit = <T>(
            run: (cells: {
                read(key: CellKey): CellState | undefined
                write(key: CellKey, cell: CellState): void
                /** Sets the value as a queued change against what DHIS2 last confirmed. */
                queue(
                    key: CellKey,
                    value: string | undefined,
                    source: Source
                ): void
            }) => T
        ): T => {
            let cells = get().cells
            let copied = false
            const queued: Array<[CellKey, string | null, string | null]> = []
            const read = (key: CellKey) => cells[key]
            const write = (key: CellKey, cell: CellState) => {
                if (!copied) {
                    cells = { ...cells }
                    copied = true
                }
                cells[key] = cell
            }
            const queue = (
                key: CellKey,
                value: string | undefined,
                source: Source
            ) => {
                const cell = read(key) ?? EMPTY_CELL
                write(key, {
                    ...cell,
                    value,
                    draft: undefined,
                    error: undefined,
                    warning: warningOf(key, value),
                    sync: 'queued',
                    reason: undefined,
                    source,
                })
                queued.push([key, value ?? null, cell.base ?? null])
            }
            const result = run({ read, write, queue })
            if (copied) {
                set({ cells })
            }
            for (const [key, value, base] of queued) {
                enqueue(key, value, base)
            }
            return result
        }

        const commitMany = (
            entries: ReadonlyArray<{ key: CellKey; text: string }>,
            source: Source = 'person'
        ) =>
            edit(({ read, write, queue }) => {
                const changed: Array<{
                    key: CellKey
                    previous: string | undefined
                }> = []
                // Undo goes back to a cell's value before the batch, however often the batch changed it.
                const seen = new Set<CellKey>()
                const results = entries.map(({ key, text }): CommitResult => {
                    const field = fieldOf(key)
                    if (field === undefined) {
                        throw new Error(`No column for the cell ${key}`)
                    }
                    const cell = read(key) ?? EMPTY_CELL
                    const parsed = parseTyped(field, text, settings)
                    // A rule's own values are not checked against what rules hide.
                    const error = !parsed.ok
                        ? parsed.problem.message
                        : parsed.value === undefined || source === 'rule'
                          ? undefined
                          : refusal(key, field, cell.value, parsed.value)
                    if (!parsed.ok || error !== undefined) {
                        write(key, { ...cell, draft: text, error })
                        return 'invalid'
                    }
                    if (parsed.value === cell.value) {
                        // A person asking again for a value that failed to save sends it again.
                        if (source === 'person' && cell.sync === 'failed') {
                            queue(key, cell.value, cell.source)
                            return 'queued'
                        }
                        // A draft and its error are set together.
                        if (cell.draft !== undefined) {
                            write(key, {
                                ...cell,
                                draft: undefined,
                                error: undefined,
                            })
                        }
                        return 'unchanged'
                    }
                    if (!seen.has(key)) {
                        seen.add(key)
                        changed.push({ key, previous: cell.value })
                    }
                    queue(key, parsed.value, source)
                    return 'queued'
                })
                // Undo is for a person's own changes, not a rule's.
                if (source === 'person' && changed.length > 0) {
                    undoStack.push(changed)
                }
                return results
            })

        return {
            cells: loaded,
            commit: (key, text, source) =>
                commitMany([{ key, text }], source)[0],
            commitMany,
            discardDraft(key) {
                edit(({ read, write }) => {
                    const cell = read(key)
                    if (cell?.draft !== undefined) {
                        write(key, {
                            ...cell,
                            draft: undefined,
                            error: undefined,
                        })
                    }
                })
            },
            undo() {
                const last = undoStack.pop()
                if (last === undefined) {
                    return []
                }
                return edit(({ read, queue }) => {
                    const undone: CellKey[] = []
                    for (const { key, previous } of last.slice().reverse()) {
                        if (read(key)?.value !== previous) {
                            queue(key, previous, 'person')
                            undone.unshift(key)
                        }
                    }
                    return undone
                })
            },
            markSync(sent, sync, reason) {
                edit(({ read, write }) => {
                    for (const { key, value } of sent) {
                        const cell = read(key)
                        if (cell === undefined) {
                            continue
                        }
                        const sentValue = value ?? undefined
                        const latest = cell.value === sentValue
                        // An outcome for an older value only moves the base, and only when it was saved.
                        if (!latest && sync !== 'saved') {
                            continue
                        }
                        write(key, {
                            ...cell,
                            base: sync === 'saved' ? sentValue : cell.base,
                            sync: latest ? sync : cell.sync,
                            reason: latest ? reason : cell.reason,
                        })
                    }
                })
            },
            restore(changes) {
                edit(({ write }) => {
                    for (const change of changes) {
                        const value = change.value ?? undefined
                        write(change.key, {
                            base: change.base ?? undefined,
                            value,
                            warning: warningOf(change.key, value),
                            sync: change.sync ?? 'queued',
                            reason: change.reason,
                            source: 'person',
                        })
                    }
                })
            },
        }
    })
}
