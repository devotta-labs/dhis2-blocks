import type { PendingChange } from '../../model/types'
import { openOutbox, outboxName } from '../outbox'
import type { Outbox, OutboxRecord } from '../outbox'
import { startSync } from '../sync'
import type {
    SaveOutcome,
    SyncHandle,
    SyncOptions,
    SyncOutcome,
    SyncStatus,
} from '../sync'

export const SOURCE = 'program:p1'

export const later = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

const deleteDatabase = (name: string) =>
    new Promise<void>((resolve, reject) => {
        const deleting = indexedDB.deleteDatabase(name)
        deleting.onsuccess = () => resolve()
        deleting.onerror = () => reject(deleting.error)
    })

const opened: Outbox[] = []
const names: string[] = []
const handles: SyncHandle[] = []
export const open = async (server: string) => {
    const outbox = await openOutbox(server, 'userA')
    opened.push(outbox)
    names.push(outboxName(server, 'userA'))
    return outbox
}

/** Run after each test: stops the loops, restores spies, closes and deletes the databases. */
export const cleanUp = async () => {
    handles.splice(0).forEach((handle) => handle.stop())
    vi.restoreAllMocks()
    opened.splice(0).forEach((outbox) => outbox.close())
    await Promise.all(names.splice(0).map(deleteDatabase))
}

// A fresh server and lock name per test, so no test sees another's database or loop.
export const setup = async () => {
    const server = `https://${crypto.randomUUID()}.example.org`
    return {
        server,
        outbox: await open(server),
        lockName: `test:${crypto.randomUUID()}`,
    }
}

export const change = (
    overrides: Partial<PendingChange> = {}
): PendingChange => ({
    sourceKey: SOURCE,
    key: 'r1.c1',
    value: '5',
    base: null,
    at: 1,
    ...overrides,
})

export const answer = (
    record: OutboxRecord,
    result: SaveOutcome['result'],
    reason?: string
): SaveOutcome => ({
    sourceKey: record.sourceKey,
    key: record.key,
    result,
    reason,
})

/** A `save` that records what it was sent and gives every record the same answer. */
export const answering = (result: SaveOutcome['result'], reason?: string) => {
    const calls: Array<{ sourceKey: string; records: OutboxRecord[] }> = []
    const save: SyncOptions['save'] = async (sourceKey, records) => {
        calls.push({ sourceKey, records: [...records] })
        return records.map((record) => answer(record, result, reason))
    }
    return { save, calls }
}

/** Starts a loop whose `sleep` answers at once and records the delay it was asked for. */
export const begin = (
    outbox: Outbox,
    lockName: string,
    save: SyncOptions['save']
) => {
    const outcomes: SyncOutcome[] = []
    const statuses: SyncStatus[] = []
    const sleeps: number[] = []
    const sync = startSync({
        outbox,
        lockName,
        save,
        onOutcomes: (reported) => outcomes.push(...reported),
        onStatus: (status) => statuses.push(status),
        sleep: async (ms) => {
            sleeps.push(ms)
        },
    })
    handles.push(sync)
    return { sync, outcomes, statuses, sleeps }
}
