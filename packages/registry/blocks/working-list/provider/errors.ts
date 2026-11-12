import { TaggedError } from 'better-result'

export class UnknownFieldError extends TaggedError('UnknownFieldError')<{
    fieldId: string
    message: string
}> {}

export class InvalidConfigurationError extends TaggedError(
    'InvalidConfigurationError'
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

export type ConfigurationCommandError =
    | UnknownFieldError
    | InvalidConfigurationError

export type CreateViewError =
    | InvalidConfigurationError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError

export type UpdateSelectedViewError =
    | InvalidConfigurationError
    | NoSelectedSavedListError
    | SavedListPermissionError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError

export type DeleteViewError =
    | SavedListNotFoundError
    | SavedListPermissionError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError

export type RepairSavedListError =
    | IncompatibleSavedListError
    | SavedListPermissionError
    | OfflineMutationError
    | WorkingListNetworkError
    | WorkingListInvalidResponseError
