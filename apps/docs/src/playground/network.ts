/**
 * The network every lab's fake server sits behind: how slow each endpoint is, whether it fails or never answers, and
 * a log of what was asked. A lab's own server only decides what comes back.
 */

/** One request as a block sends it through app-runtime. */
export interface NetworkRequest {
    resource: string
    id?: string
    params?: object
}

export interface Endpoint {
    /** Overrides the network's delay for this endpoint (ms). */
    delay?: number
    behaviour?: 'fails' | 'hangs'
}

export interface LabNetwork {
    /** Delay for every endpoint without its own (ms). */
    delay: number
    endpoints: Record<string, Endpoint | undefined>
}

export interface RequestLogEntry {
    id: number
    at: string
    /** `performance.now()` when the request was sent. */
    started: number
    request: NetworkRequest
    ms?: number
    outcome: 'pending' | 'ok' | 'failed' | 'aborted'
    detail?: string
}

export type Log = (
    update: (entries: RequestLogEntry[]) => RequestLogEntry[]
) => void

/** An error shaped like the ones app-runtime throws for an HTTP failure. */
const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), {
        details: { httpStatusCode: status, message },
    })

/** Waits `ms`, or forever when `ms` is undefined, unless the request is aborted first. */
const wait = (ms: number | undefined, signal?: AbortSignal) =>
    new Promise<void>((resolve, reject) => {
        let timer: ReturnType<typeof setTimeout> | undefined
        const abort = () => {
            clearTimeout(timer)
            reject(new DOMException('Aborted', 'AbortError'))
        }
        if (signal?.aborted) return abort()
        signal?.addEventListener('abort', abort, { once: true })
        if (ms === undefined) return
        timer = setTimeout(() => {
            signal?.removeEventListener('abort', abort)
            resolve()
        }, ms)
    })

let nextRequest = 0

/** Sends `request` through the lab network: waits, fails or hangs as its endpoint says, else `respond`s, logging it all. */
export const throughNetwork = async <Result>(
    network: LabNetwork,
    request: NetworkRequest,
    respond: () => Result | Promise<Result>,
    log: Log,
    signal?: AbortSignal
): Promise<Result> => {
    const id = ++nextRequest
    const started = performance.now()
    log((entries) =>
        [
            {
                id,
                at: new Date().toLocaleTimeString(),
                started,
                request,
                outcome: 'pending' as const,
            },
            ...entries,
        ].slice(0, 150)
    )
    const settle = (outcome: RequestLogEntry['outcome'], detail?: string) =>
        log((entries) =>
            entries.map((entry) =>
                entry.id === id
                    ? {
                          ...entry,
                          outcome,
                          detail,
                          ms: Math.round(performance.now() - started),
                      }
                    : entry
            )
        )
    const endpoint = network.endpoints[request.resource]
    try {
        await wait(
            endpoint?.behaviour === 'hangs'
                ? undefined
                : (endpoint?.delay ?? network.delay),
            signal
        )
        if (endpoint?.behaviour === 'fails') {
            throw httpError(500, 'Internal server error')
        }
        const result = await respond()
        settle('ok')
        return result
    } catch (error) {
        settle(
            signal?.aborted ? 'aborted' : 'failed',
            error instanceof Error ? error.message : 'Request failed'
        )
        throw error
    }
}
