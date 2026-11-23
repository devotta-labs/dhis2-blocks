import { FetchError } from '@dhis2/app-runtime'
import { z } from 'zod'
import type { CellKey } from '@/components/spreadsheet'
import { classify, PartlySaved, RETRY } from './failure'
import type { Outbox, OutboxRecord } from './outbox'

export interface SaveOutcome {
    sourceKey: string
    key: CellKey
    result: 'saved' | 'waiting' | 'failed'
    reason?: string
}

/** An outcome with the value and time of the change it answers, so a cell can tell it from a newer one. */
export type SyncOutcome = SaveOutcome & { value: string | null; at: number }

export type SyncStatus = 'idle' | 'sending' | 'offline' | 'signIn' | 'retrying'

/** What one tab tells the others it saved; from another tab, so parsed. */
export const outcomesMessageSchema = z.object({
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

export interface SyncOptions {
    outbox: Outbox
    /**
     * One call per source key with all its queued and waiting records, oldest first. Throws for network or
     * session failures; a refusal is an outcome. A record it gives no outcome for stays as it was. A
     * `FetchError` for a 403, a 409 or another client error (400 to 499) refuses all the records of the call. A
     * `PartlySaved` keeps the outcomes it carries, leaves the records it names as unsent queued for the next round,
     * and its failure is about the other records alone.
     */
    save(
        sourceKey: string,
        records: ReadonlyArray<OutboxRecord>
    ): Promise<SaveOutcome[]>
    onOutcomes(outcomes: ReadonlyArray<SyncOutcome>): void
    onStatus(status: SyncStatus): void
    /** Names the browser-wide lock; every tab of one user and server uses the same name. */
    lockName: string
    sleep?(ms: number): Promise<void>
    /** Defaults to the browser's Web Locks capability; null runs without cross-tab locking. */
    locks?: LockManager | null
}

export interface SyncHandle {
    /**
     * Sends what the outbox holds now; a nudge during a round schedules one more round after it, and a nudge while it
     * waits to retry ends the wait.
     */
    nudge(): void
    /** Ends the loop; settles once a round already in flight has recorded what the server took. */
    stop(): Promise<void>
    /** Runs `task` under the lock the loop sends under, so no tab's loop sends while it runs. */
    exclusive<T>(task: () => Promise<T>): Promise<T>
}

type Ref = Parameters<Outbox['remove']>[0][number]
type Mark = { state: 'waiting' | 'failed'; reason?: string; refs: Ref[] }

const FIRST_DELAY = 1000
const LONGEST_DELAY = 60_000

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

export const startSync: (options: SyncOptions) => SyncHandle = ({
    outbox,
    save,
    onOutcomes,
    onStatus,
    lockName,
    sleep = wait,
    locks = navigator.locks,
}) => {
    const lockRequest = new AbortController()
    let stopped = false
    let running = false
    let again = false
    let status: SyncStatus | undefined
    let resume: (() => void) | undefined
    let wake: (() => void) | undefined
    let looping = Promise.resolve()

    const report = (next: SyncStatus) => {
        if (!stopped && next !== status) {
            status = next
            onStatus(next)
        }
    }

    const settle = async (
        sent: ReadonlyArray<OutboxRecord>,
        outcomes: ReadonlyArray<SaveOutcome>
    ) => {
        const byKey = new Map(sent.map((record) => [record.key, record]))
        const reported: SyncOutcome[] = []
        const saved: Ref[] = []
        const marks = new Map<string, Mark>()
        for (const outcome of outcomes) {
            const record = byKey.get(outcome.key)
            if (record?.sourceKey !== outcome.sourceKey) {
                continue
            }
            const ref = {
                sourceKey: record.sourceKey,
                key: record.key,
                at: record.at,
            }
            reported.push({ ...outcome, value: record.value, at: record.at })
            if (outcome.result === 'saved') {
                saved.push(ref)
            } else {
                const id = `${outcome.result}\n${outcome.reason ?? ''}`
                const mark = marks.get(id) ?? {
                    state: outcome.result,
                    reason: outcome.reason,
                    refs: [],
                }
                mark.refs.push(ref)
                marks.set(id, mark)
            }
        }
        await outbox.remove(saved)
        for (const { state, reason, refs } of marks.values()) {
            await outbox.mark(refs, state, reason)
        }
        if (reported.length > 0) {
            onOutcomes(reported)
        }
    }

    const sendAll = async () => {
        again = false
        const bySource = new Map<string, OutboxRecord[]>()
        for (const record of await outbox.list()) {
            if (record.state !== 'failed') {
                const records = bySource.get(record.sourceKey) ?? []
                records.push(record)
                bySource.set(record.sourceKey, records)
            }
        }
        let retryError: Error | undefined
        for (const [sourceKey, records] of bySource) {
            if (stopped) {
                return
            }
            const sent = records.sort((a, b) => a.at - b.at)
            report('sending')
            let outcomes: SaveOutcome[]
            try {
                outcomes = await save(sourceKey, sent)
            } catch (thrown) {
                const done =
                    thrown instanceof PartlySaved ? thrown.outcomes : []
                await settle(sent, done)
                const error =
                    thrown instanceof PartlySaved ? thrown.failure : thrown
                const failure =
                    error instanceof FetchError ? classify(error) : RETRY
                if (failure.kind === 'signIn') {
                    throw error
                }
                if (failure.kind === 'retry') {
                    retryError ??=
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    continue
                }
                const unsent =
                    thrown instanceof PartlySaved ? thrown.unsent : []
                again ||= unsent.length > 0
                const answered = new Set([
                    ...done.map(({ key }) => key),
                    ...unsent,
                ])
                outcomes = sent
                    .filter(({ key }) => !answered.has(key))
                    .map((record) => ({
                        sourceKey,
                        key: record.key,
                        result: 'failed',
                        reason: failure.reason,
                    }))
            }
            await settle(sent, outcomes)
        }
        if (retryError) {
            throw retryError
        }
    }

    const exclusive: <T>(task: () => Promise<T>) => Promise<T> = async (
        task
    ) => {
        if (!locks) {
            return task()
        }
        return await locks.request(
            lockName,
            { signal: lockRequest.signal },
            task
        )
    }

    const attempt: () => Promise<'done' | 'retry' | 'signIn'> = async () => {
        try {
            await exclusive(sendAll)
            return 'done'
        } catch (error) {
            return error instanceof FetchError &&
                classify(error).kind === 'signIn'
                ? 'signIn'
                : 'retry'
        }
    }

    const loop = async () => {
        let delay = FIRST_DELAY
        try {
            while (!stopped) {
                if (!navigator.onLine) {
                    report('offline')
                    await new Promise<void>((resolve) => {
                        resume = resolve
                    })
                    resume = undefined
                    continue
                }
                const outcome = await attempt()
                if (stopped) {
                    return
                }
                if (outcome === 'signIn') {
                    report('signIn')
                    return
                }
                if (outcome === 'retry') {
                    report('retrying')
                    await new Promise<void>((resolve) => {
                        wake = resolve
                        void sleep(delay).then(resolve, resolve)
                    })
                    wake = undefined
                    delay = Math.min(delay * 2, LONGEST_DELAY)
                    continue
                }
                delay = FIRST_DELAY
                if (!again) {
                    report(navigator.onLine ? 'idle' : 'offline')
                    return
                }
            }
        } finally {
            running = false
        }
    }

    const nudge = () => {
        if (stopped) {
            return
        }
        if (running) {
            again = true
            wake?.()
            return
        }
        running = true
        looping = loop()
    }

    const goOnline = () => {
        if (resume) {
            resume()
        } else {
            nudge()
        }
    }
    const goOffline = () => report('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    nudge()

    return {
        nudge,
        exclusive,
        stop() {
            stopped = true
            lockRequest.abort()
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
            resume?.()
            wake?.()
            return looping
        },
    }
}
