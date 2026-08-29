import { z } from 'zod'
import type { WorkingListCapabilities } from '../api/capabilities'
import type { SavedValueFilter } from '../api/schemas'
import type {
    AppliedFilter,
    Dhis2ValueType,
    FilterOperator,
    FilterValue,
    RelativeDatePeriod,
    WorkingListField,
} from '../domain/model'

export type FilterEditorKind =
    | 'text'
    | 'numberRange'
    | 'timeRange'
    | 'dateRange'
    | 'boolean'
    | 'options'
    | 'organisationUnit'
    | 'trueOnly'
    | 'displayOnly'

export interface FilterSerializationContext {
    toApiDate?: (value: string) => string
    /** Throws when an editor date is not valid in the configured calendar. */
    validateDate?: (value: string) => void
    /** ISO date used by the Gregorian relative-date fallback. */
    today?: string
    resolveRelativeDate?: (value: {
        period?: RelativeDatePeriod
        startBuffer?: number
        endBuffer?: number
    }) => { start?: string; end?: string }
}

export interface FilterParsingContext {
    fromApiDate?: (value: string) => string
}

export interface CellFormattingContext {
    locale?: string
    trueLabel?: string
    falseLabel?: string
    resolveDisplayName?: (id: string) => string | undefined
    /** Resolves a fileResource UID to its display name (FILE_RESOURCE only). */
    resolveFileResourceName?: (id: string) => string | undefined
    formatDate?: (value: string, valueType: Dhis2ValueType) => string
    formatNumber?: (value: number, valueType: Dhis2ValueType) => string
}

/**
 * Client-side value for FILE_RESOURCE and IMAGE cells, mirroring the Capture
 * app: the fileResource UID plus tracker-scoped download URLs. Display names
 * are resolved separately via resolveFileResourceName.
 */
const WorkingListFileValueSchema = z.object({
    id: z.string(),
    url: z.string(),
    previewUrl: z.string().optional(),
})

export type WorkingListFileValue = z.infer<typeof WorkingListFileValueSchema>

/** Client-side value for the assigned-user column, mirroring the Capture app. */
const WorkingListUserValueSchema = z.object({
    id: z.string(),
    name: z.string(),
    username: z.string().optional(),
    firstName: z.string().optional(),
    surname: z.string().optional(),
})

export type WorkingListUserValue = z.infer<typeof WorkingListUserValueSchema>

/** Parses the raw tracker values accepted by registry formatting and decoding. */
export const WorkingListRawValueSchema = z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    WorkingListFileValueSchema,
    WorkingListUserValueSchema,
    z.null(),
    z.undefined(),
])

/** Values accepted after tracker responses have crossed their schema boundary. */
export type WorkingListRawValue = z.infer<typeof WorkingListRawValueSchema>

export type WorkingListParsedValue = string | number | boolean

export const isWorkingListFileValue = (
    value: WorkingListRawValue
): value is WorkingListFileValue =>
    WorkingListFileValueSchema.safeParse(value).success

export const isWorkingListUserValue = (
    value: WorkingListRawValue
): value is WorkingListUserValue =>
    WorkingListUserValueSchema.safeParse(value).success

export type CellDisplayValue =
    | { kind: 'empty'; text: '' }
    | { kind: 'text'; text: string }
    | { kind: 'link'; text: string; href: string }
    | { kind: 'file'; text: string; href: string }
    | { kind: 'image'; alt: string; href: string; previewHref: string }
    | {
          kind: 'coordinate'
          text: string
          latitude: number
          longitude: number
      }
    | {
          kind: 'reference'
          text: string
          id: string
          referenceType: 'organisationUnit'
      }

export interface ValueTypeDefinition {
    valueType: Dhis2ValueType
    editor: FilterEditorKind
    parseServerValue(value: WorkingListRawValue): WorkingListParsedValue
    parseEditorValue(value: FilterValue): FilterValue
    format(
        value: WorkingListRawValue,
        field: WorkingListField,
        context?: CellFormattingContext
    ): string
    display(
        value: WorkingListRawValue,
        field: WorkingListField,
        context?: CellFormattingContext
    ): CellDisplayValue
    operators(
        field: WorkingListField,
        capabilities: WorkingListCapabilities
    ): FilterOperator[]
    serializeQuery(
        filter: AppliedFilter,
        context?: FilterSerializationContext
    ): string
    serializeSaved(
        filter: AppliedFilter,
        context?: FilterSerializationContext
    ): Omit<SavedValueFilter, 'attribute' | 'dataItem'>
    parseSaved(
        filter: SavedValueFilter,
        context?: FilterParsingContext
    ): FilterValue
}

const interpolateTemplate = (
    template: string,
    values?: Record<string, string | number>
) =>
    template.replace(/\{\{(\w+)\}\}/g, (match, key: string) =>
        values && key in values ? String(values[key]) : match
    )

/**
 * A server value failed its value-type contract. Carries the untranslated
 * message template and values so consumers can localize the message.
 */
export class ValueParseError extends Error {
    readonly template: string
    readonly values?: Record<string, string | number>

    constructor(template: string, values?: Record<string, string | number>) {
        super(interpolateTemplate(template, values))
        this.name = 'ValueParseError'
        this.template = template
        this.values = values
    }
}
