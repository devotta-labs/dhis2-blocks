import { FetchError } from '@dhis2/app-runtime'
import i18n from '@dhis2/d2-i18n'
import { createStore } from 'zustand/vanilla'
import type { StoreApi } from 'zustand/vanilla'
import type { ValueSettings } from '@/components/dhis2-value-types'
import {
    cellAt,
    cellKey,
    createCellStore,
    formatCount,
} from '@/components/spreadsheet'
import type {
    CellKey,
    CellStoreState,
    DataEngine,
    GridTable,
} from '@/components/spreadsheet'
import { recordIdOf } from '../model/types'
import type {
    DataRecord,
    PendingChange,
    TrackerColumn,
    TrackerRow,
} from '../model/types'
import { openOutbox, outboxName } from '../outbox/outbox'
import type { Outbox, OutboxRecord } from '../outbox/outbox'
import { outcomesMessageSchema, startSync } from '../outbox/sync'
import type { SyncOutcome, SyncStatus } from '../outbox/sync'
import type {
    TrackerDataEntrySource,
    FormPage,
    LoadedForm,
} from '../sources/types'
import { addRow } from './addRow'
import { afterPaint } from './afterPaint'
import { appendPage, withPage } from './appendPage'
import { completionChecks, refusalOf, showStatus } from './completion'
import type { TrackerEffectsState } from '../logic/effects'
import { discardFailed } from './discardFailed'
import { formKeys } from './formKeys'
import { formEffects, summaryOf, withRows } from './formRows'
import type { TrackerDataEntryView } from './hooks'
import { signedInAsOther, userCheck } from './signedIn'
import { watchSlotOrder } from './slotOrderEffects'
import { saveUnsentFile } from './unsentFile'

type Actions = Pick<
    TrackerDataEntryView,
    'addRow' | 'complete' | 'reopen' | 'downloadUnsent' | 'discardFailed'
>

/** The open form's tables, with the rows added since it loaded, and the records their cells save to. */
export interface FormTables {
    tables: ReadonlyArray<GridTable<TrackerRow, TrackerColumn>>
    /** By record id, each with its status as last saved. */
    records: ReadonlyMap<string, DataRecord>
}

/** A loaded form wired to its stores, the outbox and the sync loop. */
export interface OpenForm extends Actions {
    store: StoreApi<CellStoreState>
    effects: StoreApi<TrackerEffectsState>
    tables: StoreApi<FormTables>
    /** Why a whole record is read-only, as statuses saved since loading left it. */
    readOnlyRecords: ReadonlyMap<string, string>
    /**
     * Called with a record's id as it starts completing, before its checks: rules save what they say of it here, or
     * say why it cannot complete yet.
     */
    beforeComplete: Set<(recordId: string) => string | undefined>
    newRowTables: ReadonlySet<string>
    /** Adds a page: its rows not shown yet, the columns new to a table, and their unsent changes. */
    append(page: FormPage): Promise<void>
    /** Stops syncing; changes already handed to the outbox are kept. */
    close(): void
}

interface OpenFormOptions {
    source: TrackerDataEntrySource
    form: LoadedForm
    engine: DataEngine
    settings: ValueSettings
    /** The server's absolute base URL; with the user, it names the outbox. */
    serverUrl: string
    userId: string
    /** Where the summary and the sync status go. */
    view: StoreApi<TrackerDataEntryView>
    announce(text: string, politeness?: 'polite' | 'assertive'): void
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
        const restored = await options.source.restoreRows(
            options.engine,
            unsent,
            options.form
        )
        return connect(outbox, unsent, restored, options)
    } catch (error) {
        outbox.close()
        throw error
    }
}

const connect = (
    outbox: Outbox,
    unsent: ReadonlyArray<OutboxRecord>,
    restored: Awaited<ReturnType<TrackerDataEntrySource['restoreRows']>>,
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
    const readOnlyRecords = new Map([
        ...form.readOnlyRecords,
        ...(restored.readOnlyRecords ?? []),
    ])
    const reopenable = new Set(form.canReopen)

    const newRowTable = form.newRows?.tableId ?? form.tables.at(0)?.id
    const records = new Map([
        ...form.records,
        ...restored.records.map((record) => [record.id, record] as const),
    ])
    const tables = createStore<FormTables>()(() => ({
        tables: form.tables.map((table) =>
            table.id === newRowTable && restored.rows.length > 0
                ? withRows(form, table, restored.rows, records)
                : table
        ),
        records,
    }))
    const inForm = formKeys(form, tables)
    const effects = createStore<TrackerEffectsState>()(() => ({
        cells: formEffects(
            form,
            readOnlyRecords,
            tables.getState().tables,
            records
        ),
        rowMessages: new Map(),
        rowNotes: new Map(form.rowNotes),
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
    const store = createCellStore({
        fields: form.fields,
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
                record: tables.getState().records.get(recordIdOf(key)),
            })
            // Every cell changed until the next paint goes to the outbox in one write, after the rules that change
            // asks for: they were asked first, so what they commit joins the person's change in one save.
            if (batch.length === 1) {
                cancelFlush = afterPaint(flush)
            }
        },
        annotations: effects,
        // Read-only records stay as DHIS2 has them, whatever path a change comes by.
        locked: (key) => readOnlyRecords.has(recordIdOf(key)),
    })
    store.getState().restore(
        unsent
            .filter(({ key }) => inForm(key))
            // DHIS2 holds what was just loaded, whatever it held when the change was made.
            .map((record) => ({
                ...record,
                base: form.values.get(record.key) ?? null,
                sync: record.state,
            }))
    )
    // Changes of the source no cell of the form holds (made in the program's other grids, or for people on pages not
    // loaded yet) that could not be saved, or wait: counted here, so none is stuck where no grid shows it. The failed
    // ones are downloaded and discarded here too.
    const elsewhere = (held: ReadonlyArray<OutboxRecord>) => {
        const there = held.filter(({ key }) => !inForm(key))
        return {
            failed: there.filter(({ state }) => state === 'failed').length,
            unsent: there.filter(({ state }) => state === 'waiting').length,
        }
    }
    let there = elsewhere(unsent)
    const countElsewhere = () =>
        outbox.list(source.key).then(
            (held) => {
                if (!closed) {
                    there = elsewhere(held)
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
                        : (cellAt(store.getState().cells, key)?.base ?? null),
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
            announce(i18n.t('Sign in to keep saving'), 'assertive')
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
                summed()
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
    let cancelSummary: (() => void) | undefined
    const summarize = () => {
        cancelSummary?.()
        cancelSummary = undefined
        // Closed, the view is another's: the locked form's, or the next form's.
        if (closed) {
            return
        }
        const summary = summaryOf({ store, effects, tables }, form)
        view.setState({
            summary: {
                ...summary,
                unsent: summary.unsent + there.unsent,
                failed: summary.failed + there.failed,
            },
        })
    }
    // The stores' changes until the next paint are summed up once, after it; what reads the summary first sums up what
    // waits.
    const summarizeLater = () => {
        cancelSummary ??= afterPaint(summarize)
    }
    const summed = () => {
        if (!closed && cancelSummary !== undefined) {
            summarize()
        }
    }
    const setStatus = async (
        recordId: string,
        status: 'COMPLETED' | 'ACTIVE'
    ) => {
        // Under the sync lock, so no tab's save sends a status read before this one. `complete` waits for the record's
        // sends before it gets here, outside the lock, so nothing under it waits on the loop: no deadlock.
        const outcomes = await sync
            .exclusive(() => source.setStatus(engine, recordId, status, form))
            .catch((error: Error) => {
                // The loop stopped while this waited for the lock: someone else signed in.
                if (closed || error.name !== 'AbortError') {
                    throw error
                }
                return [refusal(cellKey(recordId, 'status'), signedInAsOther())]
            })
        if (
            outcomes.some(
                ({ key, result }) =>
                    key === cellKey(recordId, 'status') && result === 'saved'
            )
        ) {
            showStatus({ ...grows, form }, recordId, status)
        }
        return outcomes
    }

    // Someone else signed in: nothing more is sent from here, and the provider locks the form.
    const { signedIn, notNow } = userCheck(engine, userId, () => {
        sync.stop()
        onSignedInAsOther()
    })
    const beforeComplete = new Set<(recordId: string) => string | undefined>()
    const grows = { store, effects, tables, readOnlyRecords, reopenable }

    const refusal = (key: CellKey, reason: string) =>
        refusalOf(source.key, key, reason)
    const { refusals, sentFrom } = completionChecks(
        source.key,
        store,
        view,
        summed
    )

    summarize()
    const unsubscribes = [
        store.subscribe(summarizeLater),
        effects.subscribe(summarizeLater),
        tables.subscribe(summarizeLater),
        watchSlotOrder({ store, effects, tables }, form.slots ?? []),
    ]

    // Created last, once nothing before can throw: the channel and the loop outlive this call.
    // Another tab's loop may send this tab's changes; it says what became of them here.
    const name = outboxName(serverUrl, userId)
    const channel = new BroadcastChannel(name)
    channel.onmessage = ({ data }) => {
        const parsed = outcomesMessageSchema.safeParse(data)
        // Closed, the form only posts: what other tabs say is not put on its store.
        if (parsed.success && !closed) {
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
            // Closed during the round: the other tabs still hear what it saved.
            if (!closed) {
                apply(outcomes)
            }
            channel.postMessage({ outcomes })
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
        readOnlyRecords,
        beforeComplete,
        newRowTables: new Set(
            form.newRows === undefined ? [] : [form.newRows.tableId]
        ),
        addRow(tableId) {
            if (!closed) {
                addRow({ ...grows, form }, source, settings, tableId)
            }
        },
        async complete(recordId) {
            // Only an event completes.
            const locked =
                tables.getState().records.get(recordId)?.kind === 'event'
                    ? readOnlyRecords.get(recordId)
                    : i18n.t('This row cannot be completed')
            if (locked !== undefined) {
                return [refusal(cellKey(recordId, 'status'), locked)]
            }
            const paused = await notNow()
            if (paused !== undefined) {
                return [refusal(cellKey(recordId, 'status'), paused)]
            }
            for (const prepare of beforeComplete) {
                const notYet = prepare(recordId)
                if (notYet !== undefined) {
                    return [refusal(cellKey(recordId, 'status'), notYet)]
                }
            }
            const now = refusals(recordId, false)
            if (now.length > 0) {
                return now
            }
            // The record's changes go first, so DHIS2 completes what the person sees.
            flush()
            sync.nudge()
            const stopped = await sentFrom(recordId)
            if (stopped !== undefined) {
                return [refusal(cellKey(recordId, 'status'), stopped)]
            }
            const later = refusals(recordId, true)
            if (later.length > 0) {
                return later
            }
            // Asked again: someone else may have signed in while the record's changes were on their way.
            const notAnyMore = await notNow()
            return notAnyMore === undefined
                ? setStatus(recordId, 'COMPLETED')
                : [refusal(cellKey(recordId, 'status'), notAnyMore)]
        },
        async reopen(recordId) {
            if (!reopenable.has(recordId)) {
                return [
                    refusal(
                        cellKey(recordId, 'status'),
                        i18n.t('This row cannot be reopened')
                    ),
                ]
            }
            const paused = await notNow()
            return paused === undefined
                ? setStatus(recordId, 'ACTIVE')
                : [refusal(cellKey(recordId, 'status'), paused)]
        },
        async append(page) {
            const held = await appendPage({ ...grows, form }, page, () =>
                outbox.list(source.key)
            )
            form = withPage(form, page)
            // Changes counted as another grid's may be this form's now.
            if (!closed) {
                there = elsewhere(held)
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
                        store.getState(),
                        tables.getState(),
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
            cancelSummary?.()
            cancelSummary = undefined
            window.removeEventListener('pagehide', onPageHide)
            window.removeEventListener('focus', onFocus)
            document.removeEventListener('visibilitychange', onVisibility)
            unsubscribes.forEach((unsubscribe) => unsubscribe())
            // A round in flight still settles its outcomes in the outbox and posts them first.
            void sync.stop().finally(() => {
                channel.close()
                outbox.close()
            })
        },
    }
}
