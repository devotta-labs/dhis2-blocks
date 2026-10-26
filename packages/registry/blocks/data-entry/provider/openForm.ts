import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { formatCount } from '../cells/OptionCell'
import { summarise } from '../logic/summary'
import { cellKey } from '../model/types'
import type { CellKey, GridRow, GridTable, PendingChange } from '../model/types'
import { openOutbox, outboxName } from '../outbox/outbox'
import type { Outbox, OutboxRecord } from '../outbox/outbox'
import { startSync } from '../outbox/sync'
import type { SyncOutcome, SyncStatus } from '../outbox/sync'
import type { DataEngine, DataEntrySource, LoadedForm } from '../sources/types'
import { generateUid } from '../sources/uid'
import { createDataEntryStore } from '../store/store'
import type { DataEntryState } from '../store/store'
import { afterPaint } from './afterPaint'
import { completionChecks, refusalOf } from './completion'
import type { EffectsState } from './context'
import { formEffects, pendingRow, rowIdOf, withRows } from './formRows'
import type { DataEntryView } from './hooks'
import { userCheck } from './signedIn'
import { saveUnsentFile } from './unsentFile'

type Actions = Pick<
    DataEntryView,
    'addRow' | 'complete' | 'reopen' | 'downloadUnsent'
>

/** A loaded form wired to its stores, the outbox and the sync loop. */
export interface OpenForm extends Actions {
    store: StoreApi<DataEntryState>
    effects: StoreApi<EffectsState>
    /** The form's tables, with the rows added since it loaded and each row's status as last saved. */
    tables: StoreApi<{ tables: ReadonlyArray<GridTable> }>
    /** Why a whole row is read-only, as statuses saved since loading left it. */
    readOnlyRows: ReadonlyMap<string, string>
    /**
     * Called with a row's id as it starts completing, before its checks: rules save what they say of it here, or say
     * why it cannot complete yet.
     */
    beforeComplete: Set<(rowId: string) => string | undefined>
    newRowTables: ReadonlySet<string>
    /** Stops syncing; changes already handed to the outbox are kept. */
    close(): void
}

interface OpenFormOptions {
    source: DataEntrySource
    form: LoadedForm
    engine: DataEngine
    settings: ValueSettings
    /** The server's absolute base URL; with the user, it names the outbox. */
    serverUrl: string
    userId: string
    /** Where the summary and the sync status go. */
    view: StoreApi<DataEntryView>
    announce(text: string): void
}

// Long enough that a burst of edits is announced once, after the last of them is saved.
const SETTLE_MS = 500

// What one tab tells the others it saved; from another tab, so parsed.
const messageSchema = z.object({
    outcomes: z.array(
        z.object({
            sourceKey: z.string(),
            key: z.templateLiteral([z.string(), '.', z.string()]),
            result: z.enum(['saved', 'waiting', 'failed']),
            reason: z.string().optional(),
            value: z.string().nullable(),
            at: z.number(),
        })
    ),
})

/**
 * Opens the user's outbox on this server, puts the form's unsent changes back on their cells (new rows included),
 * and starts the sync loop. Every change the store queues is written to the outbox, then sent.
 */
export const openForm = async (options: OpenFormOptions): Promise<OpenForm> => {
    const outbox = await openOutbox(options.serverUrl, options.userId)
    try {
        return connect(outbox, await outbox.list(options.source.key), options)
    } catch (error) {
        outbox.close()
        throw error
    }
}

const connect = (
    outbox: Outbox,
    unsent: ReadonlyArray<OutboxRecord>,
    {
        source,
        form,
        engine,
        settings,
        serverUrl,
        userId,
        view,
        announce,
    }: OpenFormOptions
): OpenForm => {
    let closed = false
    // What statuses saved here have changed since the form loaded.
    const readOnlyRows = new Map(form.readOnlyRows)
    const reopenable = new Set(form.canReopen)

    const restoredRows = source.restoreRows(unsent)
    const newRowTable = form.newRows?.tableId ?? form.tables.at(0)?.id
    const tables = createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
        tables: form.tables.map((table) =>
            table.id === newRowTable && restoredRows.length > 0
                ? withRows(form, table, restoredRows)
                : table
        ),
    }))
    const rows = new Map(
        tables
            .getState()
            .tables.flatMap((table) =>
                table.rows.map((row): [string, GridRow] => [row.id, row])
            )
    )
    const effects = createStore<EffectsState>()(() => ({
        cells: formEffects(
            form.required,
            readOnlyRows,
            tables.getState().tables
        ),
        rowMessages: new Map(),
        rowNotes: new Map(),
    }))

    // Each cell's changes get strictly later times, so an outcome for one never removes the next from the outbox.
    const lastAt = new Map(unsent.map(({ key, at }) => [key, at]))
    let batch: PendingChange[] = []
    let cancelFlush: (() => void) | undefined
    const flush = () => {
        cancelFlush?.()
        cancelFlush = undefined
        const changes = batch
        batch = []
        if (changes.length === 0) {
            return
        }
        void outbox.putMany(changes).then(
            () => sync.nudge(),
            () =>
                store
                    .getState()
                    .markSync(
                        changes,
                        'failed',
                        i18n.t('This device could not store the change')
                    )
        )
    }
    const store = createDataEntryStore({
        tables: form.tables,
        values: form.values,
        settings,
        enqueue(key, value, base) {
            const at = Math.max(Date.now(), (lastAt.get(key) ?? 0) + 1)
            lastAt.set(key, at)
            batch.push({
                sourceKey: source.key,
                key,
                value,
                base,
                at,
                row: pendingRow(rows.get(rowIdOf(key))),
            })
            // Every cell changed until the next paint goes to the outbox in one write, after the rules that change
            // asks for: they were asked first, so what they commit joins the person's change in one save.
            if (batch.length === 1) {
                cancelFlush = afterPaint(flush)
            }
        },
        // Typed and pasted alike: an option a rule hid is not an option.
        check: (key, value) =>
            effects.getState().cells[key]?.hiddenOptions?.has(value)
                ? 'Choose one of the options'
                : undefined,
    })
    store
        .getState()
        .restore(unsent.map((record) => ({ ...record, sync: record.state })))

    // Whether this form heard of its own outcomes since it last said so.
    let applied = false
    const apply = (outcomes: ReadonlyArray<SyncOutcome>) => {
        const groups = new Map<
            string,
            Pick<SyncOutcome, 'result' | 'reason'> & { sent: SyncOutcome[] }
        >()
        for (const outcome of outcomes) {
            // A refusal of an older change says nothing of the newer one in its cell.
            if (
                outcome.sourceKey !== source.key ||
                (outcome.result !== 'saved' &&
                    outcome.at < (lastAt.get(outcome.key) ?? 0))
            ) {
                continue
            }
            applied = true
            const id = `${outcome.result}\n${outcome.reason ?? ''}`
            const group = groups.get(id) ?? {
                result: outcome.result,
                reason: outcome.reason,
                sent: [],
            }
            group.sent.push(outcome)
            groups.set(id, group)
        }
        for (const { result, reason, sent } of groups.values()) {
            store.getState().markSync(sent, result, reason)
        }
    }

    let settling: ReturnType<typeof setTimeout> | undefined
    let previous: SyncStatus | undefined
    // The last state a pass ended in; each paused pass goes through `sending`, and the pause is said once.
    let ended: SyncStatus | undefined
    const onStatus = (status: SyncStatus) => {
        view.setState({ sync: status })
        clearTimeout(settling)
        if (status === 'signIn' && ended !== 'signIn') {
            announce(i18n.t('Sign in to keep saving'))
        }
        if (status !== 'sending') {
            ended = status
        }
        // Outcomes, never progress: said once sending stops and nothing follows for a moment.
        if (status === 'idle' && previous === 'sending') {
            settling = setTimeout(() => {
                if (!applied) {
                    return
                }
                applied = false
                const { failed, unsent: left } = view.getState().summary
                if (failed > 0) {
                    announce(
                        i18n.t('Values not saved: {{values}}', {
                            values: formatCount(failed),
                        })
                    )
                } else if (left === 0) {
                    announce(i18n.t('All changes saved'))
                }
            }, SETTLE_MS)
        }
        previous = status
    }

    const summarize = () =>
        view.setState({
            summary: summarise(
                store.getState().cells,
                effects.getState().cells,
                effects.getState().rowMessages,
                tables.getState().tables
            ),
        })

    const setStatus = async (rowId: string, status: 'COMPLETED' | 'ACTIVE') => {
        const outcomes = await source.setStatus(engine, rowId, status, form)
        const saved = outcomes.some(
            ({ key, result }) =>
                key === cellKey(rowId, 'status') && result === 'saved'
        )
        const row = rows.get(rowId)
        const table = tables
            .getState()
            .tables.find((each) => each.rows.some(({ id }) => id === rowId))
        if (!saved || row === undefined || table === undefined) {
            return outcomes
        }
        if (status === 'COMPLETED') {
            const blocked =
                row.programStageId === undefined
                    ? undefined
                    : form.readOnlyWhenCompleted.get(row.programStageId)
            if (blocked !== undefined) {
                readOnlyRows.set(rowId, blocked)
            }
            // As at load: a row the user could write in, and that had not expired.
            if (
                form.mayUncomplete &&
                (form.canReopen.has(rowId) || !form.readOnlyRows.has(rowId))
            ) {
                reopenable.add(rowId)
            }
        } else {
            // A row that could be reopened had no reason to be read-only but its completion.
            readOnlyRows.delete(rowId)
            reopenable.delete(rowId)
        }
        const updated = { ...row, status }
        rows.set(rowId, updated)
        effects.setState(({ cells }) => {
            const next = { ...cells }
            for (const { id } of table.columns) {
                delete next[cellKey(rowId, id)]
            }
            return {
                cells: formEffects(
                    form.required,
                    readOnlyRows,
                    [{ ...table, rows: [updated] }],
                    next
                ),
            }
        })
        tables.setState(({ tables: all }) => ({
            tables: all.map((each) =>
                each.id === table.id
                    ? {
                          ...each,
                          rows: each.rows.map((other) =>
                              other.id === rowId ? updated : other
                          ),
                      }
                    : each
            ),
        }))
        return outcomes
    }

    const { signedInHere, notNow } = userCheck(engine, userId)
    const beforeComplete = new Set<(rowId: string) => string | undefined>()

    const refusal = (key: CellKey, reason: string) =>
        refusalOf(source.key, key, reason)
    const { refusals, sentFrom } = completionChecks(source.key, store, view)

    summarize()
    const unsubscribes = [
        store.subscribe(summarize),
        effects.subscribe(summarize),
        tables.subscribe(summarize),
    ]

    // Created last, once nothing before can throw: the channel and the loop outlive this call.
    // Another tab's loop may send this tab's changes; it says what became of them here.
    const name = outboxName(serverUrl, userId)
    const channel = new BroadcastChannel(name)
    channel.onmessage = ({ data }) => {
        const parsed = messageSchema.safeParse(data)
        if (parsed.success) {
            apply(parsed.data.outcomes)
        }
    }
    const sync = startSync({
        outbox,
        save: async (sourceKey, records) => {
            // Another form's changes stay in the outbox until that form is open.
            if (sourceKey !== source.key) {
                return []
            }
            // Sent only as the user who made them: otherwise the loop pauses as for a lapsed session.
            if (!(await signedInHere())) {
                throw new FetchError({
                    type: 'access',
                    message: 'Unauthorized',
                    details: { httpStatusCode: 401 },
                })
            }
            return source.save(engine, records, form)
        },
        onOutcomes(outcomes) {
            apply(outcomes)
            if (!closed) {
                channel.postMessage({ outcomes })
            }
        },
        onStatus,
        lockName: `dhis2-data-entry-sync:${name}`,
    })

    return {
        store,
        effects,
        tables,
        readOnlyRows,
        beforeComplete,
        newRowTables: new Set(
            form.newRows === undefined ? [] : [form.newRows.tableId]
        ),
        addRow(tableId) {
            const { newRows } = form
            const table = tables
                .getState()
                .tables.find(({ id }) => id === tableId)
            if (closed || newRows?.tableId !== tableId || table === undefined) {
                return
            }
            const row: GridRow = {
                id: generateUid(),
                label: i18n.t('New event'),
                programStageId: newRows.programStageId,
                orgUnitId: newRows.orgUnitId,
                enrollmentId: newRows.enrollmentId,
                status: 'ACTIVE',
                isNew: true,
            }
            rows.set(row.id, row)
            effects.setState(({ cells }) => ({
                cells: formEffects(
                    form.required,
                    readOnlyRows,
                    [{ ...table, rows: [row] }],
                    { ...cells }
                ),
            }))
            tables.setState(({ tables: all }) => ({
                tables: all.map((each) =>
                    each.id === tableId ? withRows(form, each, [row]) : each
                ),
            }))
        },
        async complete(rowId) {
            const paused = await notNow()
            if (paused !== undefined) {
                return [refusal(cellKey(rowId, 'status'), paused)]
            }
            for (const prepare of beforeComplete) {
                const notYet = prepare(rowId)
                if (notYet !== undefined) {
                    return [refusal(cellKey(rowId, 'status'), notYet)]
                }
            }
            const now = refusals(rowId, false)
            if (now.length > 0) {
                return now
            }
            // The row's changes go first, so DHIS2 completes what the person sees.
            flush()
            sync.nudge()
            const stopped = await sentFrom(rowId)
            if (stopped !== undefined) {
                return [refusal(cellKey(rowId, 'status'), stopped)]
            }
            const later = refusals(rowId, true)
            return later.length > 0 ? later : setStatus(rowId, 'COMPLETED')
        },
        async reopen(rowId) {
            if (!reopenable.has(rowId)) {
                return [
                    refusal(
                        cellKey(rowId, 'status'),
                        i18n.t('This row cannot be reopened')
                    ),
                ]
            }
            const paused = await notNow()
            return paused === undefined
                ? setStatus(rowId, 'ACTIVE')
                : [refusal(cellKey(rowId, 'status'), paused)]
        },
        downloadUnsent() {
            // A change made since the last paint is stored first, so the file has it.
            flush()
            void outbox.list(source.key).then((saved) => {
                const kept = new Map<string, string | null>(
                    saved.map(({ key, value }) => [key, value])
                )
                // A change this device could not store is only on this page, even where it kept an older one.
                const onlyHere = Object.entries(store.getState().cells).flatMap(
                    ([key, cell]) =>
                        cell?.sync === 'failed' &&
                        kept.get(key) !== (cell.value ?? null)
                            ? [
                                  {
                                      key,
                                      value: cell.value ?? null,
                                      state: 'failed',
                                      reason: cell.reason,
                                  },
                              ]
                            : []
                )
                saveUnsentFile(
                    [...saved, ...onlyHere],
                    tables.getState().tables
                )
            })
        },
        close() {
            // A change made since the last paint still reaches the outbox before it closes.
            flush()
            closed = true
            clearTimeout(settling)
            unsubscribes.forEach((unsubscribe) => unsubscribe())
            sync.stop()
            channel.close()
            outbox.close()
        },
    }
}

/** What the provider shows until a form is open: no tables, no cells, nothing to do. */
export const emptyForm = (): OpenForm => ({
    store: createDataEntryStore({
        tables: [],
        values: new Map(),
        settings: { calendar: 'gregorian', dateFormat: 'YYYY-MM-DD' },
        enqueue: () => {},
    }),
    effects: createStore<EffectsState>()(() => ({
        cells: {},
        rowMessages: new Map(),
        rowNotes: new Map(),
    })),
    tables: createStore<{ tables: ReadonlyArray<GridTable> }>()(() => ({
        tables: [],
    })),
    readOnlyRows: new Map(),
    beforeComplete: new Set(),
    newRowTables: new Set(),
    addRow: () => {},
    complete: async () => [],
    reopen: async () => [],
    downloadUnsent: () => {},
    close: () => {},
})
