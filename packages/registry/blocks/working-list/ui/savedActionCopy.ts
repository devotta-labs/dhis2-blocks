import type { WorkingListTranslate } from '../domain/translation'
import type {
    CreateViewError,
    DeleteViewError,
    SelectViewError,
    UpdateSelectedViewError,
} from '../provider/errors'

type SavedActionError =
    | CreateViewError
    | DeleteViewError
    | SelectViewError
    | UpdateSelectedViewError
type CommonErrorTag = Exclude<
    SavedActionError['_tag'],
    'InvalidConfigurationError'
>

const commonCopy = {
    OfflineMutationError: (translate) =>
        translate('This action is unavailable while offline.'),
    WorkingListNetworkError: (translate) =>
        translate(
            'A network error stopped the request. Check the connection and try again.'
        ),
    WorkingListInvalidResponseError: (translate) =>
        translate('The server returned an unexpected response.'),
    SavedListPermissionError: (translate) =>
        translate('You do not have permission to make this change.'),
    SavedListNotFoundError: (translate) =>
        translate(
            'The working list could not be found. It may have been deleted.'
        ),
    IncompatibleSavedListError: (translate) =>
        translate('Repair this working list before saving changes to it.'),
    NoSelectedSavedListError: (translate) =>
        translate('Select a saved working list before updating it.'),
} satisfies Record<CommonErrorTag, (translate: WorkingListTranslate) => string>

export const savedActionErrorCopy = (
    error: SavedActionError,
    translate: WorkingListTranslate,
    invalidConfigurationCopy: (translate: WorkingListTranslate) => string
) =>
    error._tag === 'InvalidConfigurationError'
        ? invalidConfigurationCopy(translate)
        : commonCopy[error._tag](translate)
