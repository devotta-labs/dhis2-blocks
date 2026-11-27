import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import { parseDhis2Calendar } from '@/components/dhis2-value-display'
import { parseDateFormat } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'

export const PROGRAM_FIELDS =
    'id,displayName,categoryCombo[id,isDefault,categories[id,displayName,categoryOptions[id,displayName,access[data[write]],organisationUnits[id],startDate,endDate]]],programStages[id,displayName,displayExecutionDateLabel,featureType,validationStrategy,blockEntryForm,access[data[write]],programStageDataElements[compulsory,allowFutureDate,dataElement[id,displayFormName,displayDescription,valueType,fieldMask,optionSet[options[code,displayName]]]],programStageSections[id,displayName,dataElements[id]]]'

/**
 * An event's own fields with its values: an update replaces the own fields, so an edit sends them back. Its notes are
 * shown, never sent back. `completedAt` is left out: DHIS2 keeps it, and refuses it on an event set back to active.
 */
export const EVENT_FIELDS =
    'event,program,programStage,orgUnit,enrollment,occurredAt,scheduledAt,status,followUp,attributeOptionCombo,attributeCategoryOptions,geometry,assignedUser[uid,username],dataValues[dataElement,value],notes[note,value,storedAt,storedBy,createdBy[displayName]]'

const stageSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    displayExecutionDateLabel: z.string().nullish(),
    // `SYMBOL` is an org unit's; on a stage, as anything else unknown, it is none.
    featureType: z
        .enum(['NONE', 'POINT', 'POLYGON', 'MULTI_POLYGON'])
        .catch('NONE'),
    validationStrategy: z
        .enum(['ON_COMPLETE', 'ON_UPDATE_AND_INSERT'])
        .default('ON_UPDATE_AND_INSERT'),
    blockEntryForm: z.boolean().default(false),
    access: z.object({ data: z.object({ write: z.boolean() }) }),
    programStageDataElements: z.array(
        z.object({
            compulsory: z.boolean().default(false),
            allowFutureDate: z.boolean().default(false),
            dataElement: z.object({
                id: z.string(),
                displayFormName: z.string(),
                displayDescription: z.string().nullish(),
                valueType: z.string(),
                fieldMask: z.string().optional(),
                optionSet: z
                    .object({
                        options: z.array(
                            z.object({
                                code: z.string(),
                                displayName: z.string(),
                            })
                        ),
                    })
                    .optional(),
            }),
        })
    ),
    programStageSections: z
        .array(
            z.object({
                id: z.string(),
                displayName: z.string().optional(),
                dataElements: z.array(z.object({ id: z.string() })),
            })
        )
        .default([]),
})

const categoryComboSchema = z.object({
    id: z.string(),
    isDefault: z.boolean(),
    categories: z.array(
        z.object({
            id: z.string(),
            displayName: z.string(),
            categoryOptions: z.array(
                z.object({
                    id: z.string(),
                    displayName: z.string(),
                    access: z.object({
                        data: z.object({ write: z.boolean() }),
                    }),
                    organisationUnits: z
                        .array(z.object({ id: z.string() }))
                        .default([]),
                    startDate: z.string().optional(),
                    endDate: z.string().optional(),
                })
            ),
        })
    ),
})

export const programSchema = z.object({
    displayName: z.string().optional(),
    // Absent is the default combination, as every program without one has.
    categoryCombo: categoryComboSchema.optional(),
    programStages: z.array(stageSchema),
})

export const systemInfoSchema = z.object({
    calendar: z.string().optional(),
    dateFormat: z.string().optional(),
})

const noteSchema = z.object({
    note: z.string(),
    value: z.string(),
    storedAt: z.string().optional(),
    /** The username of who wrote it. */
    storedBy: z.string().optional(),
    createdBy: z.object({ displayName: z.string().optional() }).optional(),
})

/** A note on the event: DHIS2 only adds them, so one is never changed or removed. */
export type EventNote = z.infer<typeof noteSchema>

export const heldEventSchema = z.object({
    event: z.string(),
    program: z.string(),
    programStage: z.string(),
    orgUnit: z.string(),
    enrollment: z.string().optional(),
    occurredAt: z.string().optional(),
    scheduledAt: z.string().optional(),
    status: z.enum([
        'ACTIVE',
        'COMPLETED',
        'SCHEDULE',
        'SKIPPED',
        'VISITED',
        'OVERDUE',
    ]),
    followUp: z.boolean().optional(),
    attributeOptionCombo: z.string().optional(),
    /** The event's category options, comma-separated. */
    attributeCategoryOptions: z.string().optional(),
    geometry: z.object({ type: z.string(), coordinates: z.json() }).optional(),
    assignedUser: z
        .object({ uid: z.string(), username: z.string().optional() })
        .optional(),
    dataValues: z
        .array(
            z.object({ dataElement: z.string(), value: z.string().optional() })
        )
        .default([]),
    notes: z.array(noteSchema).default([]),
})

export type HeldEvent = z.infer<typeof heldEventSchema>

/** Data element id → stored value; empty values are absent. */
export type Values = Readonly<Record<string, string>>

export interface FormField {
    id: string
    label: string
    description?: string
    field: Field
    compulsory: boolean
    /** Whether a date or date and time may be later than today. */
    allowFutureDate: boolean
}

export interface CategoryOption {
    id: string
    name: string
    canWrite: boolean
    /** The org units it is limited to; empty is everywhere. */
    orgUnitIds: readonly string[]
    startDate?: string
    endDate?: string
}

/** One category of the program's combination: a required choice of one of its options. */
export interface Category {
    id: string
    name: string
    options: readonly CategoryOption[]
    /** The options as a choice field, by option id. */
    field: Field
}

interface FormSection {
    id: string
    name?: string
    fieldIds: readonly string[]
}

/** A program stage's feature type: DHIS2 refuses an event whose geometry is of another type (E1012). */
export type FeatureType = z.infer<typeof stageSchema>['featureType']

export interface StageForm {
    id: string
    name: string
    programName?: string
    eventDateLabel: string
    /** The type the event's geometry must have, or `NONE` for a stage that records no location. */
    featureType: FeatureType
    validationStrategy: 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'
    blockEntryForm: boolean
    canWrite: boolean
    /** Every data element of the stage, shown or not. */
    fields: ReadonlyMap<string, FormField>
    sections: readonly FormSection[]
    /** The categories of a non-default combination, in order; none for the default one. */
    categories: readonly Category[]
}

/** The stage's form; a stage without sections is one unnamed section of every field, in stage order. */
export const stageFormOf = (
    program: z.infer<typeof programSchema>,
    stageId: string
): StageForm | undefined => {
    const stage = program.programStages.find(({ id }) => id === stageId)
    if (stage === undefined) {
        return undefined
    }
    const fields = new Map(
        stage.programStageDataElements.map(
            ({
                compulsory,
                allowFutureDate,
                dataElement,
            }): [string, FormField] => [
                dataElement.id,
                {
                    id: dataElement.id,
                    label: dataElement.displayFormName,
                    description: dataElement.displayDescription ?? undefined,
                    compulsory,
                    allowFutureDate,
                    field: {
                        valueType: dataElement.valueType,
                        fieldMask: dataElement.fieldMask,
                        options: dataElement.optionSet?.options.map(
                            ({ code, displayName }) => ({
                                code,
                                name: displayName,
                            })
                        ),
                    },
                },
            ]
        )
    )
    const sections =
        stage.programStageSections.length === 0
            ? [{ id: stage.id, fieldIds: [...fields.keys()] }]
            : stage.programStageSections.map(
                  ({ id, displayName, dataElements }) => ({
                      id,
                      name: displayName,
                      fieldIds: dataElements
                          .map((element) => element.id)
                          .filter((fieldId) => fields.has(fieldId)),
                  })
              )
    return {
        id: stage.id,
        name: stage.displayName,
        programName: program.displayName,
        eventDateLabel:
            stage.displayExecutionDateLabel ?? i18n.t('Report date'),
        featureType: stage.featureType,
        validationStrategy: stage.validationStrategy,
        blockEntryForm: stage.blockEntryForm,
        canWrite: stage.access.data.write,
        fields,
        sections,
        categories:
            program.categoryCombo?.isDefault === false
                ? program.categoryCombo.categories.map(
                      ({ id, displayName, categoryOptions }) => ({
                          id,
                          name: displayName,
                          options: categoryOptions.map((option) => ({
                              id: option.id,
                              name: option.displayName,
                              canWrite: option.access.data.write,
                              orgUnitIds: option.organisationUnits.map(
                                  (unit) => unit.id
                              ),
                              startDate: option.startDate,
                              endDate: option.endDate,
                          })),
                          field: {
                              valueType: 'TEXT',
                              options: categoryOptions.map((option) => ({
                                  code: option.id,
                                  name: option.displayName,
                              })),
                          },
                      })
                  )
                : [],
    }
}

export const settingsOf = (
    info: z.infer<typeof systemInfoSchema>
): ValueSettings => ({
    calendar: parseDhis2Calendar(info.calendar),
    dateFormat: parseDateFormat(info.dateFormat ?? ''),
})

export const valuesOf = (event: HeldEvent): Values =>
    Object.fromEntries(
        event.dataValues.flatMap(({ dataElement, value }) =>
            value ? [[dataElement, value]] : []
        )
    )
