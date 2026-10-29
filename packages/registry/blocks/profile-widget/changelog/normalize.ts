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
    currentRawValue: string | null
}

const EMPTY_VALUE: ProfileFieldValue = { kind: 'empty' }

const formatChangelogUser = (createdBy: ApiChangelogEntry['createdBy']) => {
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

export const selectChangelogFilterAttributes = (
    attributes: readonly TrackedEntityAttributeField[],
    programId: string | null
) =>
    attributes.filter((attribute) =>
        programId
            ? attribute.origin !== 'trackedEntityType'
            : attribute.origin !== 'program'
    )
