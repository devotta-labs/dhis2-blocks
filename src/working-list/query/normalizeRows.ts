import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { TrackerEvent, TrackedEntity } from '../api/schemas'
import type { FieldCatalog, WorkingListField } from '../domain/model'
import { getValueTypeDefinition, ValueParseError } from '../registry/valueTypes'

const ParsedTrackerScalarSchema = z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
])

/**
 * A single normalized cell. Structural and system-column failures stay
 * fail-fast; a data value that breaks its value-type contract becomes an
 * invalid cell so the row can still render.
 */
export type WorkingListCellValue =
    | { valid: true; value: string | number | boolean | undefined }
    | { valid: false; raw: unknown; message: string }

export type WorkingListRowValues = Readonly<
    Record<string, WorkingListCellValue>
>

export interface WorkingListRowIssue {
    fieldId: string
    fieldName: string
    message: string
    raw?: unknown
}

export type RowIssueTranslate = (
    message: string,
    values?: Record<string, string | number | boolean | undefined>
) => string

const defaultTranslate: RowIssueTranslate = (message, values) =>
    i18n.t(message, values)

export interface NormalizedTrackedEntity {
    trackedEntity: TrackedEntity
    values: WorkingListRowValues
    issues: ReadonlyArray<WorkingListRowIssue>
}

export interface NormalizedEvent {
    event: TrackerEvent
    values: WorkingListRowValues
    issues: ReadonlyArray<WorkingListRowIssue>
}

/** System columns keep today's fail-fast contract: a bad value throws. */
const parseSystemValue = (value: unknown, field?: WorkingListField) =>
    field
        ? ParsedTrackerScalarSchema.parse(
              getValueTypeDefinition(field.valueType).parseServerValue(value)
          )
        : ParsedTrackerScalarSchema.parse(value)

const missingRequiredCell = (
    translate: RowIssueTranslate
): WorkingListCellValue => ({
    valid: false,
    raw: undefined,
    message: translate('A required value is missing'),
})

const dataValueCell = (
    raw: unknown,
    context: {
        field?: WorkingListField
        required: boolean
        translate: RowIssueTranslate
    }
): WorkingListCellValue => {
    const { field, required, translate } = context
    if (raw === undefined || raw === '') {
        return required
            ? missingRequiredCell(translate)
            : { valid: true, value: undefined }
    }
    if (!field) {
        const parsed = ParsedTrackerScalarSchema.safeParse(raw)
        return parsed.success
            ? { valid: true, value: parsed.data }
            : {
                  valid: false,
                  raw,
                  message: translate('The value has an unsupported type'),
              }
    }
    try {
        const parsed = ParsedTrackerScalarSchema.parse(
            getValueTypeDefinition(field.valueType).parseServerValue(raw)
        )
        if (field.options?.length && parsed !== '') {
            const knownCodes = new Set(
                field.options.map((option) => option.code)
            )
            const values =
                field.valueType === 'MULTI_TEXT'
                    ? String(parsed).split(',')
                    : [String(parsed)]
            const unknown = values.find((item) => !knownCodes.has(item))
            if (unknown !== undefined) {
                return {
                    valid: false,
                    raw,
                    message: translate('{{value}} is not a known option', {
                        value: unknown,
                    }),
                }
            }
        }
        return { valid: true, value: parsed }
    } catch (error) {
        return {
            valid: false,
            raw,
            message:
                error instanceof ValueParseError
                    ? translate(error.template, error.values)
                    : translate('The value has an unsupported type'),
        }
    }
}

const collectIssues = (
    values: Record<string, WorkingListCellValue>,
    fields: FieldCatalog
): WorkingListRowIssue[] =>
    Object.entries(values).flatMap(([fieldId, cell]) =>
        cell.valid
            ? []
            : [
                  {
                      fieldId,
                      fieldName: fields.get(fieldId)?.displayName ?? fieldId,
                      message: cell.message,
                      raw: cell.raw,
                  },
              ]
    )

export interface NormalizeTrackedEntityOptions {
    programId?: string
    translate?: RowIssueTranslate
}

/**
 * Validate and type every metadata-known tracked-entity value at the query
 * boundary. System columns fail fast; data values collect per-cell issues.
 */
export const normalizeTrackedEntityValues = (
    trackedEntity: TrackedEntity,
    fields: FieldCatalog,
    options: NormalizeTrackedEntityOptions = {}
): NormalizedTrackedEntity => {
    const translate = options.translate ?? defaultTranslate
    const values: Record<string, WorkingListCellValue> = {}

    for (const attribute of trackedEntity.attributes) {
        const field = fields.get(attribute.attribute)
        values[attribute.attribute] = dataValueCell(attribute.value, {
            field,
            required: field?.required === true,
            translate,
        })
    }
    for (const field of fields.values()) {
        if (
            field.source === 'trackedEntityAttribute' &&
            !(field.id in values)
        ) {
            values[field.id] = field.required
                ? missingRequiredCell(translate)
                : { valid: true, value: undefined }
        }
    }

    values.createdAt = {
        valid: true,
        value: trackedEntity.createdAt
            ? String(
                  parseSystemValue(
                      trackedEntity.createdAt,
                      fields.get('createdAt')
                  )
              )
            : undefined,
    }
    const ownerField = fields.get('programOwnerId')
    const owners = trackedEntity.programOwners.map((programOwner) =>
        String(parseSystemValue(programOwner.orgUnit, ownerField))
    )
    const ownerIndex = options.programId
        ? trackedEntity.programOwners.findIndex(
              (owner) => owner.program === options.programId
          )
        : -1
    values.programOwnerId = {
        valid: true,
        value: ownerIndex >= 0 ? owners[ownerIndex] : owners[0],
    }

    return {
        trackedEntity,
        values,
        issues: collectIssues(values, fields),
    }
}

export interface NormalizeEventOptions {
    programStageId?: string
    translate?: RowIssueTranslate
}

/**
 * Validate and type every metadata-known event value at the query boundary.
 * System columns fail fast; data values collect per-cell issues.
 */
export const normalizeEventValues = (
    event: TrackerEvent,
    fields: FieldCatalog,
    options: NormalizeEventOptions = {}
): NormalizedEvent => {
    const translate = options.translate ?? defaultTranslate
    const stageId = event.programStage ?? options.programStageId
    const values: Record<string, WorkingListCellValue> = {}

    const requiredInStage = (field: WorkingListField) =>
        Boolean(stageId && field.requiredInStageIds?.includes(stageId))

    for (const dataValue of event.dataValues) {
        const field = fields.get(dataValue.dataElement)
        values[dataValue.dataElement] = dataValueCell(dataValue.value, {
            field,
            required: field !== undefined && requiredInStage(field),
            translate,
        })
    }
    for (const field of fields.values()) {
        if (
            field.source === 'eventDataElement' &&
            stageId !== undefined &&
            field.programStageIds?.includes(stageId) &&
            !(field.id in values)
        ) {
            values[field.id] = requiredInStage(field)
                ? missingRequiredCell(translate)
                : { valid: true, value: undefined }
        }
    }

    values.eventOrgUnit = {
        valid: true,
        value: String(
            parseSystemValue(event.orgUnit, fields.get('eventOrgUnit'))
        ),
    }
    values.eventOccurredAt = {
        valid: true,
        value: event.occurredAt
            ? String(
                  parseSystemValue(
                      event.occurredAt,
                      fields.get('eventOccurredAt')
                  )
              )
            : undefined,
    }
    values.eventScheduledAt = {
        valid: true,
        value: event.scheduledAt
            ? String(
                  parseSystemValue(
                      event.scheduledAt,
                      fields.get('eventScheduledAt')
                  )
              )
            : undefined,
    }
    values.eventStatus = { valid: true, value: event.status }
    values.eventAssignedUser = {
        valid: true,
        value: event.assignedUser
            ? [event.assignedUser.firstName, event.assignedUser.surname]
                  .filter(Boolean)
                  .join(' ') ||
              event.assignedUser.username ||
              event.assignedUser.uid
            : undefined,
    }

    return {
        event,
        values,
        issues: collectIssues(values, fields),
    }
}
