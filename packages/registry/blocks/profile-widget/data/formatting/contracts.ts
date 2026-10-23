import type { QueryParameters } from '../../api/client'
import type { ProfileWidgetRequestError } from '../../errors'
import type {
    ProfileField,
    ProfileFieldOption,
    ProfileFieldValue,
    ProfileValueType,
} from '../../types'

/*
 * The value-formatting seam. The data hooks implement it; the changelog reuses
 * it for previous/current values. One pipeline means calendar dates, option
 * names, file names and org-unit paths look the same everywhere.
 */

/** One raw value plus the metadata needed to format it. */
export interface FormattableValue {
    valueType: ProfileValueType
    rawValue: string | null
    options?: readonly ProfileFieldOption[]
    /**
     * FILE_RESOURCE / IMAGE only: where DHIS2 serves the file. The pipeline
     * appends `/file` or `/image` (plus `dimension=small` for the preview) and
     * builds the href with `buildApiHref`. Without it, files render as text.
     */
    file?: { endpoint: string; params?: QueryParameters }
    /** The field's label; names the image in its alt text. */
    label: string
}

/** A value with its identity, formatted into a `ProfileField`. */
export interface FormattableField extends FormattableValue {
    id: string
}

/** Formats values synchronously once system info and lookups are loaded. */
export interface ValueFormatter {
    format(value: FormattableValue): ProfileFieldValue
    /** A server ISO date-time in the system calendar and date format, with HH:mm. */
    formatDateTime(value: string): string
}

export interface ValueFormatterState {
    /** Defined once system info and every lookup for `values` resolved. */
    formatter: ValueFormatter | undefined
    error: ProfileWidgetRequestError | null
    /** True while `values` is undefined or anything is still loading. */
    isPending: boolean
}

export interface FormattedFieldsState {
    data: readonly ProfileField[] | undefined
    error: ProfileWidgetRequestError | null
    /** True while `fields` is undefined or anything is still loading. */
    isPending: boolean
}
