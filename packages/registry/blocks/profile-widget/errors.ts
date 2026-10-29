import { TaggedError } from 'better-result'

export interface TrackerErrorReport {
    message: string
    errorCode?: string
    trackerType?: string
    uid?: string
}

export class TrackedEntityNotAccessibleError extends TaggedError(
    'TrackedEntityNotAccessibleError'
)<{
    trackedEntityId: string
    programId: string | null
    httpStatus: 403 | 404
    message: string
    cause?: unknown
}> {}

export class ProfileWidgetRequestError extends TaggedError(
    'ProfileWidgetRequestError'
)<{
    operation: string
    message: string
    httpStatus?: number
    cause?: unknown
}> {}

export class ProfileWidgetInvalidResponseError extends TaggedError(
    'ProfileWidgetInvalidResponseError'
)<{
    operation: string
    message: string
    cause?: unknown
}> {}

export class TrackerImportError extends TaggedError('TrackerImportError')<{
    operation: string
    message: string
    errorReports: readonly TrackerErrorReport[]
    cause?: unknown
}> {}
