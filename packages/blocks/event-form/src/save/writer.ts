import { Result } from 'better-result'
import { z } from 'zod'
import type { EventFormApiError, EventFormClient } from '../api/client'
import {
    mapImportReport,
    parseImportReport,
    parseImportResponse,
} from './importReport'
import type { EventPayload } from './payload'

export type SaveError =
    | {
          kind: 'validation'
          fieldErrors: Record<string, string>
          formErrors: string[]
      }
    | { kind: 'network'; message: string }
    | { kind: 'unknown'; message: string }

export type SaveOutcome = 'saved' | 'queued'

export type EventWriter = (
    payload: EventPayload
) => Promise<Result<{ outcome: SaveOutcome }, SaveError>>

const SAVE_PARAMS = {
    importStrategy: 'CREATE_AND_UPDATE',
    atomicMode: 'OBJECT',
    async: false,
} as const

/** What app-runtime's FetchError carries: `details` is the response body, or the cause for a network failure. */
const FailureSchema = z.looseObject({
    type: z.string().optional(),
    message: z.string().optional(),
    // A network failure carries the rejected fetch's error here, which is not JSON.
    details: z.json().optional().catch(undefined),
})

const BodySchema = z.looseObject({ message: z.string().optional() })

const dataElementIdsOf = ({ events }: EventPayload) =>
    new Set(events[0].dataValues.map(({ dataElement }) => dataElement))

const toSaveError = (
    error: EventFormApiError,
    dataElementIds: ReadonlySet<string>
): SaveError => {
    const failure = FailureSchema.safeParse(error.cause)
    const type = failure.success ? failure.data.type : undefined
    const details = failure.success ? failure.data.details : undefined
    const serverMessage =
        BodySchema.safeParse(details).data?.message ??
        (failure.success ? failure.data.message : undefined) ??
        error.message
    const report = parseImportReport(details)
    if (error.status === 409 || report !== undefined) {
        const mapped = report
            ? mapImportReport(report, dataElementIds)
            : { fieldErrors: {}, formErrors: [] }
        return {
            kind: 'validation',
            fieldErrors: mapped.fieldErrors,
            formErrors:
                mapped.formErrors.length === 0 &&
                Object.keys(mapped.fieldErrors).length === 0
                    ? [serverMessage]
                    : mapped.formErrors,
        }
    }
    // app-runtime wraps a rejected fetch in a FetchError of type `network`, and an HTTP failure
    // as `access` or `unknown`. Anything else (a ZodError, a bug) is no connection problem: it is
    // `unknown`, so an outbox does not queue it to fail again.
    if (type === 'network') {
        return {
            kind: 'network',
            message: (failure.success && failure.data.message) || error.message,
        }
    }
    return { kind: 'unknown', message: serverMessage }
}

/** Posts the event to `/tracker` and waits for the import report. A 200 is only `saved` when the import report shows the event was imported. */
export const createOnlineEventWriter =
    (client: EventFormClient): EventWriter =>
    async (payload) => {
        const dataElementIds = dataElementIdsOf(payload)
        const result = await client.mutate({
            resource: 'tracker',
            type: 'create',
            params: SAVE_PARAMS,
            data: payload,
        })
        if (result.isErr()) {
            return Result.err(toSaveError(result.error, dataElementIds))
        }
        // With atomicMode=OBJECT a 200 can still mean the event was rejected.
        const report = parseImportResponse(
            z.json().safeParse(result.value).data
        )
        const errorReports = report?.validationReport?.errorReports ?? []
        if (report !== undefined && errorReports.length > 0) {
            const { fieldErrors, formErrors } = mapImportReport(
                report,
                dataElementIds
            )
            return Result.err({ kind: 'validation', fieldErrors, formErrors })
        }
        const ignored = report?.stats?.ignored ?? 0
        if (report?.status === 'ERROR' || ignored > 0) {
            return Result.err({
                kind: 'unknown',
                message:
                    report?.message ??
                    `The server did not import the event (status ${report?.status ?? 'unknown'}, ${ignored} ignored)`,
            })
        }
        return Result.ok({ outcome: 'saved' })
    }
