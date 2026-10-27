import i18n from '@dhis2/d2-i18n'
import type { StoreApi } from 'zustand/vanilla'
import { blocksCompletion } from '../logic/summary'
import { cellKey } from '../model/types'
import type { CellKey, CellState, SyncState } from '../model/types'
import type { SaveOutcome, SyncStatus } from '../outbox/sync'
import { SAVE_TIMEOUT } from '../sources/eventSave'
import type { DataEntryState } from '../store/store'
import type { DataEntryView } from './hooks'

// Server reasons are shown as DHIS2 gives them, not HTML-escaped.
const AS_IS = { escapeValue: false }

// Changes the store has handed to the outbox that DHIS2 does not have yet.
const UNSENT = new Set<SyncState>(['queued', 'sending'])

/** Why nothing goes to DHIS2 while the sync loop is paused in this state. */
export const pauseReason = (sync: SyncStatus) =>
    sync === 'offline'
        ? i18n.t('You are offline')
        : sync === 'signIn'
          ? i18n.t('Sign in to keep saving')
          : undefined

export const refusalOf = (
    sourceKey: string,
    key: CellKey,
    reason: string
): SaveOutcome => ({ sourceKey, key, result: 'failed', reason })

/** What `complete` checks of a row before it asks DHIS2, and the wait for the row's changes to be sent. */
export const completionChecks = (
    sourceKey: string,
    store: StoreApi<DataEntryState>,
    view: StoreApi<DataEntryView>
) => {
    const refusal = (key: CellKey, reason: string) =>
        refusalOf(sourceKey, key, reason)
    const rowCells = (rowId: string) =>
        Object.entries(store.getState().cells).flatMap(
            ([key, cell]): Array<[CellKey, CellState]> =>
                cell !== undefined && key.startsWith(`${rowId}.`)
                    ? [[cellKey(rowId, key.slice(rowId.length + 1)), cell]]
                    : []
        )
    return {
        /**
         * What stops the row completing: its errors and empty required fields (its own: `r1.…` and `r1`, never
         * `r10.…`), changes refused or waiting, and once its changes were given time to go, any DHIS2 still lacks.
         */
        refusals: (rowId: string, afterSending: boolean) => [
            ...view
                .getState()
                .summary.items.filter(
                    (item) =>
                        (item.key === rowId ||
                            item.key.startsWith(`${rowId}.`)) &&
                        blocksCompletion(item)
                )
                .map(({ key, text }) =>
                    refusal(
                        cellKey(
                            rowId,
                            key === rowId
                                ? 'status'
                                : key.slice(rowId.length + 1)
                        ),
                        text
                    )
                ),
            ...rowCells(rowId).flatMap(([key, { sync, reason }]) =>
                sync === 'failed'
                    ? [
                          refusal(
                              key,
                              i18n.t('Not saved: {{reason}}', {
                                  nsSeparator: '::',
                                  reason: reason ?? '',
                                  interpolation: AS_IS,
                              })
                          ),
                      ]
                    : sync === 'waiting'
                      ? [refusal(key, reason ?? '')]
                      : afterSending && UNSENT.has(sync)
                        ? [refusal(key, i18n.t('Not yet sent to DHIS2'))]
                        : []
            ),
        ],
        /**
         * Settles once none of the row's changes waits to be sent, or after as long as a save may take; early, with
         * the reason, when sending pauses (offline, or signed out) after the row's changes were nudged.
         */
        sentFrom: (rowId: string) =>
            new Promise<string | undefined>((resolve) => {
                const waiting = () =>
                    rowCells(rowId).some(([, { sync }]) => UNSENT.has(sync))
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
