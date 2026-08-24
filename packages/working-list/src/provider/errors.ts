import { TaggedError } from 'better-result'

export class UnknownFieldError extends TaggedError('UnknownFieldError')<{
    fieldId: string
    message: string
}> {}

export class UnknownProgramStageError extends TaggedError(
    'UnknownProgramStageError'
)<{ programStageId: string; message: string }> {}

export class InvalidConfigurationError extends TaggedError(
    'InvalidConfigurationError'
)<{ message: string }> {}

export class InvalidPaginationError extends TaggedError(
    'InvalidPaginationError'
)<{ message: string }> {}

export class SavedListNotFoundError extends TaggedError(
    'SavedListNotFoundError'
)<{ savedListId: string; message: string }> {}

export class IncompatibleSavedListError extends TaggedError(
    'IncompatibleSavedListError'
)<{ savedListId: string; message: string }> {}

export class SavedListPermissionError extends TaggedError(
    'SavedListPermissionError'
)<{ savedListId: string; operation: 'update' | 'delete'; message: string }> {}

export class NoSelectedSavedListError extends TaggedError(
    'NoSelectedSavedListError'
)<{ message: string }> {}

export class OfflineMutationError extends TaggedError('OfflineMutationError')<{
    message: string
}> {}

export class WorkingListNetworkError extends TaggedError(
    'WorkingListNetworkError'
)<{ operation: string; message: string; cause?: unknown }> {}

export class WorkingListInvalidResponseError extends TaggedError(
    'WorkingListInvalidResponseError'
)<{ operation: string; message: string; cause?: unknown }> {}

export class WorkingListInitializationError extends TaggedError(
    'WorkingListInitializationError'
)<{ message: string; cause?: unknown }> {}

export class WorkingListResultsError extends TaggedError(
    'WorkingListResultsError'
)<{ message: string; cause?: unknown }> {}

export class DownloadVisibleRowsError extends TaggedError(
    'DownloadVisibleRowsError'
)<{ message: string; cause?: unknown }> {}

export type ConfigurationCommandError =
    | UnknownFieldError
    | UnknownProgramStageError
    | InvalidConfigurationError

export type PaginationCommandError = InvalidPaginationError

export type SelectSavedListError = InvalidConfigurationError

export type CreateSavedListError =
    | InvalidConfigurationError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError

export type UpdateSelectedSavedListError =
    | InvalidConfigurationError
    | NoSelectedSavedListError
    | SavedListNotFoundError
    | IncompatibleSavedListError
    | SavedListPermissionError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError

export type DeleteSavedListError =
    | SavedListNotFoundError
    | SavedListPermissionError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError
