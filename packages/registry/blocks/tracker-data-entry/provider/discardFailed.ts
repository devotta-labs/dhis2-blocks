import type { StoreApi } from 'zustand/vanilla'
import { cellAt, cellEntries } from '@/components/spreadsheet'
import type { SyncState, CellStoreState } from '@/components/spreadsheet'
import type { PendingChange } from '../model/types'
import type { Outbox } from '../outbox/outbox'

/**
 * Drops the program's changes that could not be saved from the outbox, those of its other grids too, and puts this
 * form's cells back: to the older change the device still holds where it could not store a newer one, else to what
 * DHIS2 has.
 */
export const discardFailed = async (
    outbox: Outbox,
    sourceKey: string,
    store: StoreApi<CellStoreState>
) => {
    const failed = [...cellEntries(store.getState().cells)].flatMap(
        ([key, cell]) =>
            cell.sync === 'failed' ? [{ key, base: cell.base ?? null }] : []
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
            .filter(
                ({ key }) =>
                    cellAt(store.getState().cells, key)?.sync === 'failed'
            )
            .map(({ key, base }): PendingChange & { sync: SyncState } => {
                const record = kept.get(key)
                return record === undefined
                    ? { sourceKey, key, value: base, base, at: 0, sync: 'idle' }
                    : { ...record, sync: record.state }
            })
    )
}
