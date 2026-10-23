import i18n from '@dhis2/d2-i18n'
import { trackedEntityAttributeFileEndpoint } from '../api/requests'
import type { ApiChangelogEntry, ApiChangelogResponse } from '../api/schemas'
import type {
    FormattableValue,
    ValueFormatter,
} from '../data/formatting/contracts'
import type {
    ProfileFieldOption,
    ProfileFieldValue,
    ProfileValueType,
    TrackedEntityAttributeField,
    TrackedEntityChangelogEntry,
    TrackedEntityChangeType,
} from '../types'

/*
 * Turns a changelog page into entries in two steps. `prepareChangelogEntries`
 * pairs every row with its attribute metadata and builds the raw values the
 * formatting pipeline needs; once the formatter is ready,
 * `formatChangelogEntries` produces the public entries. Rows are labelled from
 * the `attributes` passed in, never dropped: an attribute missing from them
 * (for example one the profile could not read) shows its id as plain text.
 */

/** A changelog row before its values are formatted. */
interface PreparedChangelogEntry {
    id: string
    createdAt: string
    user: TrackedEntityChangelogEntry['user']
    attributeId: string
    attributeLabel: string
    changeType: TrackedEntityChangeType
    previousValue: FormattableValue | null
    currentValue: FormattableValue | null
}

export interface PreparedChangelogPage {
    entries: readonly PreparedChangelogEntry[]
    hasNextPage: boolean
}

interface ChangelogAttributeDefinition {
    label: string
    valueType: ProfileValueType
    options?: readonly ProfileFieldOption[]
    /** The attribute's current server value; only it has a file endpoint. */
    currentRawValue: string | null
}

const EMPTY_VALUE: ProfileFieldValue = { kind: 'empty' }

/** "First Last (username)", or the username when no name is known. */
export const formatChangelogUser = (
    createdBy: ApiChangelogEntry['createdBy']
) => {
    const name = [createdBy.firstName, createdBy.surname]
        .map((part) => part?.trim() ?? '')
        .filter((part) => part.length > 0)
        .join(' ')
    return name ? `${name} (${createdBy.username})` : createdBy.username
}

const definitionFor = (
    attributeId: string,
    attributes: ReadonlyMap<string, TrackedEntityAttributeField>
): ChangelogAttributeDefinition => {
    const attribute = attributes.get(attributeId)
    return attribute
        ? {
              label: attribute.label,
              valueType: attribute.valueType,
              options: attribute.options,
              currentRawValue: attribute.rawValue,
          }
        : { label: attributeId, valueType: 'TEXT', currentRawValue: null }
}

const isFileValueType = (valueType: ProfileValueType) =>
    valueType === 'FILE_RESOURCE' || valueType === 'IMAGE'

/**
 * DHIS2 serves a tracked entity attribute's file only for its current value,
 * so a replaced or deleted file or image shows a plain "File" / "Image" label,
 * as in Capture. That also avoids looking up file resources that may be gone.
 */
const replacedFileLabel = (valueType: ProfileValueType) =>
    valueType === 'IMAGE' ? i18n.t('Image') : i18n.t('File')

const toFormattableValue = (
    rawValue: string | undefined,
    definition: ChangelogAttributeDefinition,
    scope: {
        trackedEntityId: string
        attributeId: string
        programId: string | null
    }
): FormattableValue | null => {
    if (rawValue === undefined || rawValue === '') {
        return null
    }
    if (!isFileValueType(definition.valueType)) {
        return {
            valueType: definition.valueType,
            rawValue,
            options: definition.options,
            label: definition.label,
        }
    }
    if (rawValue !== definition.currentRawValue) {
        return {
            valueType: 'TEXT',
            rawValue: replacedFileLabel(definition.valueType),
            label: definition.label,
        }
    }
    return {
        valueType: definition.valueType,
        rawValue,
        label: definition.label,
        file: {
            endpoint: trackedEntityAttributeFileEndpoint(
                scope.trackedEntityId,
                scope.attributeId
            ),
            params: { program: scope.programId ?? undefined },
        },
    }
}

/** Pairs each row with its attribute metadata; drops nothing. */
export const prepareChangelogPage = (
    response: ApiChangelogResponse,
    attributes: readonly TrackedEntityAttributeField[],
    scope: { trackedEntityId: string; programId: string | null }
): PreparedChangelogPage => {
    const attributesById = new Map(
        attributes.map((attribute) => [attribute.id, attribute])
    )
    const entries = response.changeLogs.map(
        (row, index): PreparedChangelogEntry => {
            const attributeId = row.change.attributeValue.attribute
            const definition = definitionFor(attributeId, attributesById)
            const valueScope = { ...scope, attributeId }
            return {
                // Several rows share a timestamp and attribute; the index keeps keys unique.
                id: `${row.createdAt}-${attributeId}-${index}`,
                createdAt: row.createdAt,
                user: {
                    username: row.createdBy.username,
                    displayName: formatChangelogUser(row.createdBy),
                },
                attributeId,
                attributeLabel: definition.label,
                changeType: row.type,
                previousValue: toFormattableValue(
                    row.change.attributeValue.previousValue,
                    definition,
                    valueScope
                ),
                currentValue: toFormattableValue(
                    row.change.attributeValue.currentValue,
                    definition,
                    valueScope
                ),
            }
        }
    )
    return {
        entries,
        hasNextPage: Boolean(response.pager?.nextPage),
    }
}

/** Every raw value of a page, for `useValueFormatter`. */
export const changelogFormattableValues = (
    page: PreparedChangelogPage
): readonly FormattableValue[] =>
    page.entries.flatMap((entry) =>
        [entry.previousValue, entry.currentValue].filter(
            (value): value is FormattableValue => value !== null
        )
    )

export const formatChangelogEntries = (
    page: PreparedChangelogPage,
    formatter: ValueFormatter
): readonly TrackedEntityChangelogEntry[] =>
    page.entries.map((entry) => ({
        id: entry.id,
        createdAt: entry.createdAt,
        createdAtLabel: formatter.formatDateTime(entry.createdAt),
        user: entry.user,
        attributeId: entry.attributeId,
        attributeLabel: entry.attributeLabel,
        changeType: entry.changeType,
        previousValue: entry.previousValue
            ? formatter.format(entry.previousValue)
            : EMPTY_VALUE,
        currentValue: entry.currentValue
            ? formatter.format(entry.currentValue)
            : EMPTY_VALUE,
    }))

/**
 * The attributes the changelog call can return, for the data-item filter.
 * With a program, DHIS2 joins the program's attributes; without one it reads
 * the tracked entity type's attributes.
 */
export const selectChangelogFilterAttributes = (
    attributes: readonly TrackedEntityAttributeField[],
    programId: string | null
) =>
    attributes.filter((attribute) =>
        programId
            ? attribute.origin !== 'trackedEntityType'
            : attribute.origin !== 'program'
    )
