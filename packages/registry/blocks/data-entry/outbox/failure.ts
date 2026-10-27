import type { FetchError } from '@dhis2/app-runtime'
import { z } from 'zod'
import type { SaveOutcome } from './sync'

/**
 * A save that stopped partway: the outcomes of what it finished before `failure` stopped it. The sync loop keeps
 * those, and deals with the rest of the records as it deals with `failure`.
 */
export class PartlySaved extends Error {
    constructor(
        readonly outcomes: ReadonlyArray<SaveOutcome>,
        readonly failure: Error
    ) {
        super(failure.message)
        this.name = 'PartlySaved'
    }
}

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

export const RETRY: Failure = { kind: 'retry' }

const RETRYABLE_CLIENT_ERRORS = new Set([408, 429])

/**
 * The platform throws `access` for 401, 403 and 409: a 401 means the session has lapsed and the others refuse
 * the records. Any other client error (400 to 499) is a refusal too, except a timeout (408) or too many requests
 * (429); those, a server error or no status may pass on a retry.
 */
export const classify = (
    error: Pick<FetchError, 'type' | 'message' | 'details'>
): Failure => {
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
