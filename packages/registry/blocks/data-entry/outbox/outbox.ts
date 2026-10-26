import { z } from 'zod'
import type { PendingChange } from '../model/types'

export interface OutboxRecord extends PendingChange {
    state: 'queued' | 'waiting' | 'failed'
    reason?: string
}

/** Names the record; `at` limits the action to a record that still has that `at`. */
type RecordRef = Pick<OutboxRecord, 'sourceKey' | 'key'> & { at?: number }

export interface Outbox {
    /** Coalesces by `sourceKey` + `key`: a later change replaces an earlier one, keeping its `base`. */
    put(change: PendingChange): Promise<void>
    /** Writes every change in one transaction, coalescing like `put`. */
    putMany(changes: ReadonlyArray<PendingChange>): Promise<void>
    list(sourceKey?: string): Promise<OutboxRecord[]>
    /** A record whose `at` differs from the one given was replaced by a newer change and is left alone. */
    mark(
        records: ReadonlyArray<RecordRef>,
        state: OutboxRecord['state'],
        reason?: string
    ): Promise<void>
    /** A record whose `at` differs from the one given was replaced by a newer change and is left alone. */
    remove(records: ReadonlyArray<RecordRef>): Promise<void>
    close(): void
}

const STORE = 'changes'

const recordSchema = z.object({
    sourceKey: z.string(),
    key: z.templateLiteral([z.string(), '.', z.string()]),
    value: z.string().nullable(),
    base: z.string().nullable(),
    at: z.number(),
    row: z
        .object({
            programStageId: z.string(),
            orgUnitId: z.string(),
            enrollmentId: z.string().optional(),
            isNew: z.boolean(),
        })
        .optional(),
    state: z.enum(['queued', 'waiting', 'failed']),
    reason: z.string().optional(),
})

/** One database per server and user, so one person's unsent changes are never sent in another's session. */
export const outboxName = (serverBaseUrl: string, userId: string) =>
    `dhis2-data-entry:${serverBaseUrl.replace(/\/+$/, '')}:${userId}`

const keyOf = ({ sourceKey, key }: Pick<OutboxRecord, 'sourceKey' | 'key'>) => [
    sourceKey,
    key,
]

const request = <T>(idbRequest: IDBRequest<T>) =>
    new Promise<T>((resolve, reject) => {
        idbRequest.onsuccess = () => resolve(idbRequest.result)
        idbRequest.onerror = () => reject(idbRequest.error)
    })

/** A record that does not parse is treated as absent, so one bad record never blocks the rest. */
const readRecord = async (store: IDBObjectStore, ref: RecordRef) => {
    const parsed = recordSchema.safeParse(await request(store.get(keyOf(ref))))
    return parsed.success ? parsed.data : undefined
}

const open = (name: string) =>
    new Promise<IDBDatabase>((resolve, reject) => {
        const opening = indexedDB.open(name, 1)
        opening.onupgradeneeded = () =>
            opening.result.createObjectStore(STORE, {
                keyPath: ['sourceKey', 'key'],
            })
        opening.onsuccess = () => resolve(opening.result)
        opening.onerror = () => reject(opening.error)
    })

export const openOutbox = async (
    serverBaseUrl: string,
    userId: string
): Promise<Outbox> => {
    const db = await open(outboxName(serverBaseUrl, userId))
    // Lets a schema change or a deleted database in another tab go ahead.
    db.onversionchange = () => db.close()

    const inTransaction = async (
        work: (store: IDBObjectStore) => Promise<void>
    ) => {
        const tx = db.transaction(STORE, 'readwrite')
        const finished = new Promise<void>((resolve, reject) => {
            tx.oncomplete = () => resolve()
            tx.onabort = () =>
                reject(tx.error ?? new Error('The outbox transaction aborted'))
        })
        try {
            // A failed request rejects `work` with its own error before the abort reaches `finished`.
            await Promise.all([finished, work(tx.objectStore(STORE))])
        } catch (error) {
            try {
                tx.abort()
            } catch {
                // A failed request has aborted the transaction already.
            }
            throw error
        }
    }

    const putMany: Outbox['putMany'] = (changes) =>
        inTransaction(async (store) => {
            for (const change of changes) {
                const earlier = await readRecord(store, change)
                store.put({
                    ...change,
                    base: earlier ? earlier.base : change.base,
                    state: 'queued',
                })
            }
        })

    const update = (
        records: ReadonlyArray<RecordRef>,
        apply: (store: IDBObjectStore, stored: OutboxRecord) => void
    ) =>
        inTransaction(async (store) => {
            for (const ref of records) {
                const stored = await readRecord(store, ref)
                if (stored && (ref.at === undefined || stored.at === ref.at)) {
                    apply(store, stored)
                }
            }
        })

    return {
        put: (change) => putMany([change]),
        putMany,
        async list(sourceKey) {
            const store = db.transaction(STORE, 'readonly').objectStore(STORE)
            // Array keys sort after strings, so this spans every key of the source.
            const stored = await request(
                store.getAll(
                    sourceKey === undefined
                        ? undefined
                        : IDBKeyRange.bound([sourceKey], [sourceKey, []])
                )
            )
            return stored.flatMap((raw) => {
                const parsed = recordSchema.safeParse(raw)
                return parsed.success ? [parsed.data] : []
            })
        },
        mark: (records, state, reason) =>
            update(records, (store, stored) =>
                store.put({ ...stored, state, reason })
            ),
        remove: (records) =>
            update(records, (store, stored) => store.delete(keyOf(stored))),
        close: () => db.close(),
    }
}
