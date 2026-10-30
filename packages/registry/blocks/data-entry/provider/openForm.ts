import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { formatCount } from '../cells/OptionCell'
import { cellKey, rowIdOf } from '../model/types'
import type { CellKey, GridRow, GridTable, PendingChange } from '../model/types'
import { openOutbox, outboxName } from '../outbox/outbox'
import type { Outbox, OutboxRecord } from '../outbox/outbox'
import { outcomesMessageSchema, startSync } from '../outbox/sync'
import type { SyncOutcome, SyncStatus } from '../outbox/sync'
import type {
    DataEngine,
    DataEntrySource,
    FormPage,
    LoadedForm,
} from '../sources/types'
import { generateUid } from '../sources/uid'
import { createDataEntryStore } from '../store/store'
import type { DataEntryState } from '../store/store'
import { afterPaint } from './afterPaint'
import { appendPage, withPage } from './appendPage'
import { completionChecks, refusalOf, showStatus } from './completion'
import type { EffectsState } from './context'
import { discardFailed } from './discardFailed'
import { formEffects, pendingRow, summaryOf, withRows } from './formRows'
import type { DataEntryView } from './hooks'
import { signedInAsOther, userCheck } from './signedIn'
import { saveUnsentFile } from './unsentFile'

type Actions = Pick<
    DataEntryView,
    'addRow' | 'complete' | 'reopen' | 'downloadUnsent' | 'discardFailed'
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
    /** Adds a page: its rows not shown yet, the columns new to a table, and their unsent changes. */
    append(page: FormPage): Promise<void>
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
    /** Called when the server says someone else is signed in; the form has stopped sending by then. */
    onSignedInAsOther(): void
}

// Long enough that a burst of edits is announced once, after the last of them is saved.
const SETTLE_MS = 500

/**
 * Opens the user's outbox on this server, puts the form's unsent changes back on their cells (new rows included),
 * and starts the sync loop. Every change the store queues is written to the outbox, then sent, with the changes made
 * in the program's other grids.
 */
export const openForm = async (options: OpenFormOptions): Promise<OpenForm> => {
    const outbox = await openOutbox(options.serverUrl, options.userId)
    try {
        const unsent = await outbox.list(options.source.key)
        const restoredRows = await options.source.restoreRows(
            options.engine,
            unsent,
            options.form
        )
        return connect(outbox, unsent, restoredRows, options)
    } catch (error) {
        outbox.close()
        throw error
    }
}

const connect = (
    outbox: Outbox,
    unsent: ReadonlyArray<OutboxRecord>,
    restoredRows: ReadonlyArray<GridRow>,
    {
        source,
        form,
        engine,
        settings,
        serverUrl,
        userId,
        view,
        announce,
        onSignedInAsOther,
    }: OpenFormOptions
): OpenForm => {
    let closed = false
    // What statuses saved here have changed since the form loaded.
    const readOnlyRows = new Map(form.readOnlyRows)
    const reopenable = new Set(form.canReopen)

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
    /** Whether the cell is in this form: the outbox also holds changes made in the program's other grids. */
    const inForm = (key: string) => {
        const rowId = rowIdOf(key)
        const column = key.slice(rowId.length + 1)
        return tables
            .getState()
            .tables.some(
                (table) =>
                    table.rows.some(({ id }) => id === rowId) &&
                    table.columns.some(({ id }) => id === column)
            )
    }
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
                ? i18n.t('Choose one of the options')
                : undefined,
    })
    store
        .getState()
        .restore(
            unsent
                .filter(({ key }) => inForm(key))
                .map((record) => ({ ...record, sync: record.state }))
        )

    // Changes made in the program's other grids that could not be saved: counted, downloaded and discarded here too,
    // so none is stuck where no grid shows it.
    const failedElsewhere = (held: ReadonlyArray<OutboxRecord>) =>
        held.filter(({ key, state }) => state === 'failed' && !inForm(key))
            .length
    let failedThere = failedElsewhere(unsent)
    const countElsewhere = () =>
        outbox.list(source.key).then(
            (held) => {
                if (!closed) {
                    failedThere = failedElsewhere(held)
                    summarize()
                }
            },
            // Closed meanwhile: there is no one to tell.
            () => {}
        )

    // Whether this form heard of its own outcomes since it last said so.
    let applied = false
    const apply = (outcomes: ReadonlyArray<SyncOutcome>) => {
        const groups = new Map<
            string,
            Pick<SyncOutcome, 'result' | 'reason'> & { sent: SyncOutcome[] }
        >()
        const later: SyncOutcome[] = []
        for (const outcome of outcomes) {
            const last = lastAt.get(outcome.key) ?? 0
            // A refusal of an older change says nothing of the newer one in its cell.
            if (
                outcome.sourceKey !== source.key ||
                (outcome.result !== 'saved' && outcome.at < last)
            ) {
                continue
            }
            applied = true
            // Another tab changed the cell later: its value, and what became of it, replace this tab's.
            if (outcome.at > last && inForm(outcome.key)) {
                lastAt.set(outcome.key, outcome.at)
                later.push(outcome)
                continue
            }
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
        store.getState().restore(
            later.map(({ key, value, result, reason }) => ({
                key,
                value,
                base:
                    result === 'saved'
                        ? value
                        : (store.getState().cells[key]?.base ?? null),
                sync: result,
                reason,
            }))
        )
        if (outcomes.some(({ key }) => !inForm(key))) {
            void countElsewhere()
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
                            nsSeparator: '::',
                            values: formatCount(failed),
                        })
                    )
                } else if (left === 0) {
                    // Changes from the program's other grids are sent from here too: all are saved once none is left.
                    outbox.list(source.key).then(
                        (held) => {
                            if (held.length === 0 && !closed) {
                                announce(i18n.t('All changes saved'))
                            }
                        },
                        // Closed meanwhile: there is no one to tell.
                        () => {}
                    )
                }
            }, SETTLE_MS)
        }
        previous = status
    }

    const summarize = () => {
        const summary = summaryOf({ store, effects, tables })
        view.setState({
            summary: { ...summary, failed: summary.failed + failedThere },
        })
    }

    const setStatus = async (rowId: string, status: 'COMPLETED' | 'ACTIVE') => {
        // Under the sync lock, so no tab's save sends a status read before this one. `complete` waits for the row's
        // sends before it gets here, outside the lock, so nothing under it waits on the loop: no deadlock.
        const outcomes = await sync
            .exclusive(() => source.setStatus(engine, rowId, status, form))
            .catch((error: Error) => {
                // The loop stopped while this waited for the lock: someone else signed in.
                if (closed || error.name !== 'AbortError') {
                    throw error
                }
                return [refusal(cellKey(rowId, 'status'), signedInAsOther())]
            })
        if (
            outcomes.some(
                ({ key, result }) =>
                    key === cellKey(rowId, 'status') && result === 'saved'
            )
        ) {
            showStatus({ ...grows, form }, rowId, status)
        }
        return outcomes
    }

    // Someone else signed in: nothing more is sent from here, and the provider locks the form.
    const { signedIn, notNow } = userCheck(engine, userId, () => {
        sync.stop()
        onSignedInAsOther()
    })
    const beforeComplete = new Set<(rowId: string) => string | undefined>()
    const grows = { store, effects, tables, rows, readOnlyRows, reopenable }

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
        const parsed = outcomesMessageSchema.safeParse(data)
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
            // Sent only as the user who made them: signed out, the loop pauses as for a lapsed session.
            const who = await signedIn()
            if (who === 'lapsed') {
                throw new FetchError({
                    type: 'access',
                    message: 'Unauthorized',
                    details: { httpStatusCode: 401 },
                })
            }
            return who === 'here' ? source.save(engine, records, form) : []
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

    // A hidden or closing page may never paint again: what waits for a paint is stored at once.
    const onPageHide = () => flush()
    // A pause for signing in ends when the person comes back: they may have signed in again elsewhere.
    const onFocus = () => {
        if (view.getState().sync === 'signIn') {
            sync.nudge()
        }
    }
    const onVisibility = () => {
        if (document.visibilityState === 'hidden') {
            flush()
        } else {
            onFocus()
        }
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

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
                stage: newRows.stage,
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
            const locked = rows.has(rowId)
                ? readOnlyRows.get(rowId)
                : i18n.t('This row cannot be completed')
            if (locked !== undefined) {
                return [refusal(cellKey(rowId, 'status'), locked)]
            }
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
            if (later.length > 0) {
                return later
            }
            // Asked again: someone else may have signed in while the row's changes were on their way.
            const notAnyMore = await notNow()
            return notAnyMore === undefined
                ? setStatus(rowId, 'COMPLETED')
                : [refusal(cellKey(rowId, 'status'), notAnyMore)]
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
        async append(page) {
            const held = await appendPage({ ...grows, form }, page, () =>
                outbox.list(source.key)
            )
            form = withPage(form, page)
            // Changes counted as another grid's may be this form's now.
            if (!closed) {
                failedThere = failedElsewhere(held)
                summarize()
            }
        },
        downloadUnsent() {
            // A change made since the last paint is stored first, so the file has it.
            flush()
            // A closed outbox still leaves the failed changes only this page holds.
            void outbox
                .list(source.key)
                .catch(() => [])
                .then((held) =>
                    saveUnsentFile(
                        held,
                        inForm,
                        store.getState().cells,
                        tables.getState().tables,
                        settings
                    )
                )
        },
        async discardFailed() {
            await discardFailed(outbox, source.key, store)
            await countElsewhere()
        },
        close() {
            // A change made since the last paint still reaches the outbox before it closes.
            flush()
            closed = true
            clearTimeout(settling)
            window.removeEventListener('pagehide', onPageHide)
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibility)
            unsubscribes.forEach((unsubscribe) => unsubscribe())
            sync.stop()
            channel.close()
            outbox.close()
        },
    }
}
