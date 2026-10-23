import { TaggedError } from 'better-result'

/** One entry of a tracker import `validationReport.errorReports` list. */
export interface TrackerErrorReport {
    message: string
    errorCode?: string
    trackerType?: string
    uid?: string
}

/**
 * The tracked entity is missing, soft-deleted, outside the user's scope, or
 * (2.42+) not enrolled and owned in the requested program. DHIS2 answers 404
 * on 2.42+. 2.41 answers 403 when the user cannot reach the owner org unit,
 * and does not check the enrollment at all. `httpStatus` keeps the difference
 * for a later break-the-glass flow.
 */
export class TrackedEntityNotAccessibleError extends TaggedError(
    'TrackedEntityNotAccessibleError'
)<{
    trackedEntityId: string
    programId: string | null
    httpStatus: 403 | 404
    message: string
    cause?: unknown
}> {}

/** A request failed to reach DHIS2 or DHIS2 answered with an error status. */
export class ProfileWidgetRequestError extends TaggedError(
    'ProfileWidgetRequestError'
)<{
    operation: string
    message: string
    httpStatus?: number
    cause?: unknown
}> {}

/** DHIS2 answered, but the response failed boundary validation. */
export class ProfileWidgetInvalidResponseError extends TaggedError(
    'ProfileWidgetInvalidResponseError'
)<{
    operation: string
    message: string
    cause?: unknown
}> {}

/** A tracker import (`POST tracker`) was rejected with error reports. */
export class TrackerImportError extends TaggedError('TrackerImportError')<{
    operation: string
    message: string
    errorReports: readonly TrackerErrorReport[]
    cause?: unknown
}> {}
