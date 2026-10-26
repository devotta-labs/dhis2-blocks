import { FetchError } from '@dhis2/app-runtime'
import { z } from 'zod'
import type { CellKey } from '../model/types'
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

export interface SyncOptions {
    outbox: Outbox
    /**
     * One call per source key with all its queued and waiting records, oldest first. Throws for network or
     * session failures; a refusal is an outcome. A record it gives no outcome for stays as it was. A
     * `FetchError` for a 403, a 409 or another client error (400 to 499) refuses all the records of the call.
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
}

export interface SyncHandle {
    /** Sends what the outbox holds now; a nudge during a round schedules one more round after it. */
    nudge(): void
    /** Ends the loop. A round already in flight records what the server took, then stops. */
    stop(): void
}

type Ref = Parameters<Outbox['remove']>[0][number]
type Mark = { state: 'waiting' | 'failed'; reason?: string; refs: Ref[] }

const FIRST_DELAY = 1000
const LONGEST_DELAY = 60_000

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

// DHIS2's error body carries the status and the reason; a field that is not there as a number or text counts as absent.
const bodySchema = z
    .object({
        httpStatusCode: z.number().optional().catch(undefined),
        message: z.string().optional().catch(undefined),
    })
    .catch({})

type Failure =
    | { kind: 'signIn' }
    | { kind: 'retry' }
    | { kind: 'refusal'; reason: string }

const RETRY: Failure = { kind: 'retry' }

const RETRYABLE_CLIENT_ERRORS = new Set([408, 429])

/**
 * The platform throws `access` for 401, 403 and 409: a 401 means the session has lapsed and the others refuse
 * the records. Any other client error (400 to 499) is a refusal too, except a timeout (408) or too many requests
 * (429); those, a server error or no status may pass on a retry.
 */
const classify = (error: FetchError): Failure => {
    const body = bodySchema.parse(error.details)
    const status = body.httpStatusCode
    const reason = body.message ?? error.message
    if (error.type === 'access') {
        // A 401 with no JSON message arrives as 'Unauthorized', a 403 as 'Forbidden'.
        const lapsed =
            status === undefined
                ? error.message === 'Unauthorized'
                : status === 401
        return lapsed ? { kind: 'signIn' } : { kind: 'refusal', reason }
    }
    return error.type === 'unknown' &&
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        !RETRYABLE_CLIENT_ERRORS.has(status)
        ? { kind: 'refusal', reason }
        : RETRY
}

/** Whether the error means the session has lapsed: the person must sign in before anything more is sent. */
export const sessionLapsed = (error: FetchError) =>
    classify(error).kind === 'signIn'

export const startSync = ({
    outbox,
    save,
    onOutcomes,
    onStatus,
    lockName,
    sleep = wait,
}: SyncOptions): SyncHandle => {
    const lockRequest = new AbortController()
    let stopped = false
    let running = false
    let again = false
    let status: SyncStatus | undefined
    let resume: (() => void) | undefined

    const report = (next: SyncStatus) => {
        if (!stopped && next !== status) {
            status = next
            onStatus(next)
        }
    }

    /** Saved records leave the outbox and the rest are marked; a cell changed since is left alone (by `at`). */
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
        // Failed records wait for the person to enter the value again.
        for (const record of await outbox.list()) {
            if (record.state !== 'failed') {
                const records = bySource.get(record.sourceKey) ?? []
                records.push(record)
                bySource.set(record.sourceKey, records)
            }
        }
        // A source that must be retried does not hold back the others; the round fails after them.
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
            } catch (error) {
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
                outcomes = sent.map((record) => ({
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

    const attempt = async (): Promise<'done' | 'retry' | 'signIn'> => {
        try {
            // Without Web Locks (an insecure page) tabs may both send; the requests are safe to repeat.
            await (navigator.locks
                ? navigator.locks.request(
                      lockName,
                      { signal: lockRequest.signal },
                      sendAll
                  )
                : sendAll())
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
                    await sleep(delay)
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
            // Cleared here, in the same tick as the last check of `again`, so no nudge falls between.
            running = false
        }
    }

    const nudge = () => {
        if (stopped) {
            return
        }
        if (running) {
            again = true
            return
        }
        running = true
        void loop()
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
        stop() {
            stopped = true
            lockRequest.abort()
            window.removeEventListener('online', goOnline)
            window.removeEventListener('offline', goOffline)
            resume?.()
        },
    }
}
