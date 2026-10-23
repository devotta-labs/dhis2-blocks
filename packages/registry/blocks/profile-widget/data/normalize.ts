import i18n from '@dhis2/d2-i18n'
import { trackedEntityAttributeFileEndpoint } from '../api/requests'
import type {
    ApiAttributeLink,
    ApiProgramMetadata,
    ApiTrackedEntityAttribute,
    ApiTrackedEntityRecord,
} from '../api/schemas'
import type {
    ProfileField,
    ProfileFieldOption,
    ProfileValueType,
    TrackedEntityAttributeField,
    TrackedEntityProfileData,
} from '../types'
import type { FormattableField } from './formatting/contracts'
import { decodeValueType } from './formatting/valueTypes'

export interface AttributeDefinition {
    id: string
    label: string
    valueType: ProfileValueType
    options?: readonly ProfileFieldOption[]
    origin: TrackedEntityAttributeField['origin']
    displayInList: boolean
    unique: boolean
}

const isDisplayable = (attribute: ApiTrackedEntityAttribute) =>
    attribute.access.read &&
    !(attribute.valueType === 'MULTI_TEXT' && !attribute.optionSet)

const toDefinition = (
    link: ApiAttributeLink,
    origin: AttributeDefinition['origin']
): AttributeDefinition => {
    const attribute = link.trackedEntityAttribute
    return {
        id: attribute.id,
        label: attribute.displayFormName,
        valueType: decodeValueType(attribute.valueType),
        options: attribute.optionSet?.options.map((option) => ({
            code: option.code,
            displayName: option.displayName,
        })),
        origin,
        displayInList: link.displayInList,
        unique: attribute.unique,
    }
}

export const buildAttributeDefinitions = (input: {
    trackedEntityTypeAttributes: readonly ApiAttributeLink[]
    programAttributes: readonly ApiAttributeLink[] | null
}): readonly AttributeDefinition[] => {
    const trackedEntityTypeIds = new Set(
        input.trackedEntityTypeAttributes.map(
            (link) => link.trackedEntityAttribute.id
        )
    )
    const seen = new Set<string>()
    const definitions: AttributeDefinition[] = []
    const add = (
        link: ApiAttributeLink,
        origin: AttributeDefinition['origin']
    ) => {
        const { id } = link.trackedEntityAttribute
        if (seen.has(id)) return
        seen.add(id)
        if (isDisplayable(link.trackedEntityAttribute)) {
            definitions.push(toDefinition(link, origin))
        }
    }

    for (const link of input.programAttributes ?? []) {
        add(
            link,
            trackedEntityTypeIds.has(link.trackedEntityAttribute.id)
                ? 'both'
                : 'program'
        )
    }
    for (const link of input.trackedEntityTypeAttributes) {
        add(link, 'trackedEntityType')
    }
    return definitions
}

const FILE_VALUE_TYPES: ReadonlySet<ProfileValueType> = new Set([
    'FILE_RESOURCE',
    'IMAGE',
])

export const toFormattableFields = (
    definitions: readonly AttributeDefinition[],
    record: ApiTrackedEntityRecord,
    programId: string | null
): readonly FormattableField[] => {
    const values = new Map(
        record.attributes.map((attribute) => [
            attribute.attribute,
            attribute.value,
        ])
    )
    return definitions.map((definition) => ({
        id: definition.id,
        label: definition.label,
        valueType: definition.valueType,
        rawValue: values.get(definition.id) ?? null,
        options: definition.options,
        file: FILE_VALUE_TYPES.has(definition.valueType)
            ? {
                  endpoint: trackedEntityAttributeFileEndpoint(
                      record.trackedEntity,
                      definition.id
                  ),
                  params: programId ? { program: programId } : undefined,
              }
            : undefined,
    }))
}

export const toAttributeFields = (
    definitions: readonly AttributeDefinition[],
    fields: readonly ProfileField[]
): readonly TrackedEntityAttributeField[] => {
    const fieldsById = new Map(fields.map((field) => [field.id, field]))
    return definitions.flatMap((definition) => {
        const field = fieldsById.get(definition.id)
        return field
            ? [
                  {
                      ...field,
                      origin: definition.origin,
                      displayInList: definition.displayInList,
                      unique: definition.unique,
                  },
              ]
            : []
    })
}

export const buildProfileTitle = (trackedEntityTypeName: string | undefined) =>
    trackedEntityTypeName
        ? i18n.t('{{trackedEntityTypeName}} profile', {
              trackedEntityTypeName,
              interpolation: { escapeValue: false },
          })
        : i18n.t('Profile')

const displayText = (field: ProfileField | undefined) =>
    field?.value.kind === 'text' ? field.value.text : ''

const joinValues = (
    links: readonly ApiAttributeLink[],
    fieldsById: ReadonlyMap<string, ProfileField>
) =>
    links
        .slice(0, 2)
        .map((link) =>
            displayText(fieldsById.get(link.trackedEntityAttribute.id))
        )
        .filter((value) => value !== '')
        .join(' ')

export const buildDisplayName = (
    trackedEntityTypeAttributes: readonly ApiAttributeLink[],
    fields: readonly ProfileField[]
) => {
    const fieldsById = new Map(fields.map((field) => [field.id, field]))
    return (
        joinValues(
            trackedEntityTypeAttributes.filter((link) => link.displayInList),
            fieldsById
        ) || joinValues(trackedEntityTypeAttributes, fieldsById)
    )
}

export const resolveProfileLabels = (
    program: ApiProgramMetadata | null
): TrackedEntityProfileData['labels'] => ({
    attributes:
        program?.displayTrackedEntityAttributesLabel || i18n.t('attributes'),
    enrollments: program?.displayEnrollmentsLabel || i18n.t('enrollments'),
    events: program?.displayEventsLabel || i18n.t('events'),
})
