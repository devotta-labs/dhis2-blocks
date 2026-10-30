import type { StoreApi } from 'zustand/vanilla'
import { cellKey, rowIdOf } from '../model/types'
import type { PendingChange, SyncState } from '../model/types'
import type { Outbox } from '../outbox/outbox'
import type { DataEntryState } from '../store/store'

/**
 * Drops the program's changes that could not be saved from the outbox, those of its other grids too, and puts this
 * form's cells back: to the older change the device still holds where it could not store a newer one, else to what
 * DHIS2 has.
 */
export const discardFailed = async (
    outbox: Outbox,
    sourceKey: string,
    store: StoreApi<DataEntryState>
) => {
    const failed = Object.entries(store.getState().cells).flatMap(
        ([key, cell]) => {
            const rowId = rowIdOf(key)
            return cell?.sync === 'failed'
                ? [
                      {
                          key: cellKey(rowId, key.slice(rowId.length + 1)),
                          base: cell.base ?? null,
                      },
                  ]
                : []
        }
    )
    const keys = new Set(failed.map(({ key }) => key))
    const held = await outbox.list(sourceKey)
    // By `at`: a change entered again meanwhile stays.
    await outbox.remove(held.filter(({ state }) => state === 'failed'))
    const kept = new Map(
        held
            .filter(({ key, state }) => state !== 'failed' && keys.has(key))
            .map((record) => [record.key, record])
    )
    store.getState().restore(
        failed
            // A cell entered again meanwhile keeps its new change.
            .filter(({ key }) => store.getState().cells[key]?.sync === 'failed')
            .map(({ key, base }): PendingChange & { sync: SyncState } => {
                const record = kept.get(key)
                return record === undefined
                    ? { sourceKey, key, value: base, base, at: 0, sync: 'idle' }
                    : { ...record, sync: record.state }
            })
    )
}
