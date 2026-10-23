import type { QueryParameters } from '../../api/client'
import type { ProfileWidgetRequestError } from '../../errors'
import type {
    ProfileField,
    ProfileFieldOption,
    ProfileFieldValue,
    ProfileValueType,
} from '../../types'

export interface FormattableValue {
    valueType: ProfileValueType
    rawValue: string | null
    options?: readonly ProfileFieldOption[]
    file?: { endpoint: string; params?: QueryParameters }
    label: string
}

export interface FormattableField extends FormattableValue {
    id: string
}

export interface ValueFormatter {
    format(value: FormattableValue): ProfileFieldValue
    formatDateTime(value: string): string
}

export interface ValueFormatterState {
    formatter: ValueFormatter | undefined
    error: ProfileWidgetRequestError | null
    isPending: boolean
}

export interface FormattedFieldsState {
    data: readonly ProfileField[] | undefined
    error: ProfileWidgetRequestError | null
    isPending: boolean
}
