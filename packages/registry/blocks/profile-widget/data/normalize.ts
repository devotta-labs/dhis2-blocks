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

/** One readable attribute, merged from the TET and program links. */
export interface AttributeDefinition {
    id: string
    label: string
    valueType: ProfileValueType
    options?: readonly ProfileFieldOption[]
    origin: TrackedEntityAttributeField['origin']
    /** Program-level flag when in the program, otherwise the TET flag. */
    displayInList: boolean
    unique: boolean
}

/**
 * Capture drops attributes the user cannot read (`useProgram.ts:60-62`) and
 * MULTI_TEXT attributes without an option set
 * (`useClientAttributesWithSubvalues.ts:57-60`).
 */
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

/**
 * TET ∪ program attributes in metadata order (program order first, then
 * TET-only). Drops `access.read: false` and MULTI_TEXT without an option set.
 */
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

/** Joins definitions with record values; file endpoints carry `?program=` only with a program. */
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

/** Adds origin, displayInList and unique to the formatted fields. */
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

/** "Person profile", or "Profile" when the type name is unknown. */
export const buildProfileTitle = (trackedEntityTypeName: string | undefined) =>
    trackedEntityTypeName
        ? i18n.t('{{trackedEntityTypeName}} profile', {
              trackedEntityTypeName,
              interpolation: { escapeValue: false },
          })
        : i18n.t('Profile')

/**
 * Capture's display name only uses values its converter turns into a string
 * (`useTeiDisplayName.ts:27-31`): text, option names, dates, numbers, Yes/No.
 */
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

/**
 * `useTeiDisplayName.ts`: the first two TET attributes with `displayInList`,
 * else the first two TET attributes, in TET order, joined with a space.
 * Capture's `??` (`:34`) blanked the name whenever the first value was empty;
 * here each value counts on its own. Empty when nothing has a value.
 */
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

/** Program custom terminology (2.43+), defaulting to "attributes" / "enrollments" / "events". */
export const resolveProfileLabels = (
    program: ApiProgramMetadata | null
): TrackedEntityProfileData['labels'] => ({
    attributes:
        program?.displayTrackedEntityAttributesLabel || i18n.t('attributes'),
    enrollments: program?.displayEnrollmentsLabel || i18n.t('enrollments'),
    events: program?.displayEventsLabel || i18n.t('events'),
})
