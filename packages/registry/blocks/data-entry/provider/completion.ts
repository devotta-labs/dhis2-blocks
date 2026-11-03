import i18n from '@dhis2/d2-i18n'
import type { StoreApi } from 'zustand/vanilla'
import { blocksCompletion } from '../logic/summary'
import { cellKey, formOf, recordIdOf, rowsByRecord } from '../model/types'
import type { CellKey, CellState, SyncState } from '../model/types'
import type { SaveOutcome, SyncStatus } from '../outbox/sync'
import { SAVE_TIMEOUT } from '../sources/trackerSave'
import type { DataEntryState } from '../store/store'
import type { Growing } from './appendPage'
import { formEffects } from './formRows'
import type { DataEntryView } from './hooks'

// Server reasons are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

// Changes the store has handed to the outbox that DHIS2 does not have yet.
const UNSENT = new Set<SyncState>(['queued', 'sending'])

/** Why nothing goes to DHIS2 while the sync loop is paused in this state. */
export const pauseReason = (sync: SyncStatus) => {
    if (sync === 'offline') {
        return i18n.t('You are offline')
    }
    return sync === 'signIn' ? i18n.t('Sign in to keep saving') : undefined
}

export const refusalOf = (
    sourceKey: string,
    key: CellKey,
    reason: string
): SaveOutcome => ({ sourceKey, key, result: 'failed', reason })

/** What `complete` checks of a record before it asks DHIS2, and the wait for the record's changes to be sent. */
export const completionChecks = (
    sourceKey: string,
    store: StoreApi<DataEntryState>,
    view: StoreApi<DataEntryView>
) => {
    const refusal = (key: CellKey, reason: string) =>
        refusalOf(sourceKey, key, reason)
    const recordCells = (recordId: string) =>
        Object.entries(store.getState().cells).flatMap(
            ([key, cell]): Array<[CellKey, CellState]> =>
                cell !== undefined && key.startsWith(`${recordId}.`)
                    ? [
                          [
                              cellKey(recordId, key.slice(recordId.length + 1)),
                              cell,
                          ],
                      ]
                    : []
        )
    return {
        /**
         * What stops the record completing: its errors and empty required fields (its own: `r1.…` and `r1`, never
         * `r10.…`), changes refused or waiting, and once its changes were given time to go, any DHIS2 still lacks.
         */
        refusals: (recordId: string, afterSending: boolean) => [
            ...view
                .getState()
                .summary.items.filter(
                    (item) =>
                        (item.key === recordId ||
                            item.key.startsWith(`${recordId}.`)) &&
                        blocksCompletion(item)
                )
                .map(({ key, text }) =>
                    refusal(
                        cellKey(
                            recordId,
                            key === recordId
                                ? 'status'
                                : key.slice(recordId.length + 1)
                        ),
                        text
                    )
                ),
            ...recordCells(recordId).flatMap(([key, { sync, reason }]) => {
                if (sync === 'failed') {
                    return [
                        refusal(
                            key,
                            i18n.t('Not saved: {{reason}}', {
                                nsSeparator: '::',
                                reason: reason ?? '',
                                interpolation: AS_IS,
                            })
                        ),
                    ]
                }
                if (sync === 'waiting') {
                    return [refusal(key, reason ?? '')]
                }
                return afterSending && UNSENT.has(sync)
                    ? [refusal(key, i18n.t('Not yet sent to DHIS2'))]
                    : []
            }),
        ],
        /**
         * Settles once none of the record's changes waits to be sent, or after as long as a save may take; early, with
         * the reason, when sending pauses (offline, or signed out) after the record's changes were nudged.
         */
        sentFrom: (recordId: string) =>
            new Promise<string | undefined>((resolve) => {
                const waiting = () =>
                    recordCells(recordId).some(([, { sync }]) =>
                        UNSENT.has(sync)
                    )
                if (!navigator.onLine) {
                    resolve(pauseReason('offline'))
                    return
                }
                if (!waiting()) {
                    resolve(undefined)
                    return
                }
                const done = (paused?: string) => {
                    clearTimeout(timer)
                    stopCells()
                    stopSync()
                    resolve(paused)
                }
                const timer = setTimeout(done, SAVE_TIMEOUT)
                const stopCells = store.subscribe(() => {
                    if (!waiting()) {
                        done()
                    }
                })
                const stopSync = view.subscribe(({ sync }, before) => {
                    const paused =
                        sync === before.sync ? undefined : pauseReason(sync)
                    if (paused !== undefined) {
                        done(paused)
                    }
                })
            }),
    }
}

/**
 * Puts a status saved here on its event record: completed in a stage that blocks entry, the record is read-only, and
 * the user may reopen it as at load; reopened, it is neither. The effects of the record's cells are written again.
 */
export const showStatus = (
    { form, effects, tables, readOnlyRecords, reopenable }: Growing,
    recordId: string,
    status: 'COMPLETED' | 'ACTIVE'
) => {
    const { tables: all, records } = tables.getState()
    const record = records.get(recordId)
    const row = rowsByRecord(all).get(recordId)
    if (record?.kind !== 'event' || row === undefined) {
        return
    }
    if (status === 'COMPLETED') {
        const blocked = form.readOnlyWhenCompleted.get(formOf(record))
        if (blocked !== undefined) {
            readOnlyRecords.set(recordId, blocked)
        }
        // As at load: a record the user could write in, and that had not expired.
        if (
            form.mayUncomplete &&
            (form.canReopen.has(recordId) ||
                !form.readOnlyRecords.has(recordId))
        ) {
            reopenable.add(recordId)
        }
    } else {
        // A record that could be reopened had no reason to be read-only but its completion.
        readOnlyRecords.delete(recordId)
        reopenable.delete(recordId)
    }
    const updated = new Map(records).set(recordId, { ...record, status })
    effects.setState(({ cells }) => {
        // Every cell of the record is made again, shown in a column or not.
        const next = Object.fromEntries(
            Object.entries(cells).filter(
                ([key]) => recordIdOf(key) !== recordId
            )
        )
        return {
            cells: formEffects(
                form,
                readOnlyRecords,
                // The record alone: its row's other records keep their effects.
                [{ rows: [{ id: recordId }] }],
                updated,
                next
            ),
        }
    })
    tables.setState({ records: updated })
}
