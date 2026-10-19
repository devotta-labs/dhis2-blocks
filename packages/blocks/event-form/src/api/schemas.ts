import { Result } from 'better-result'
import { z } from 'zod'
import { EventFormApiError } from './client'

const VALIDATION_STRATEGIES = [
    'NONE',
    'ON_COMPLETE',
    'ON_UPDATE_AND_INSERT',
] as const
const FEATURE_TYPES = ['NONE', 'POINT', 'POLYGON'] as const
const EVENT_STATUSES = [
    'ACTIVE',
    'COMPLETED',
    'SCHEDULE',
    'OVERDUE',
    'SKIPPED',
    'VISITED',
] as const
const CALENDARS = [
    'coptic',
    'ethiopian',
    'gregorian',
    'islamic',
    'iso8601',
    'nepali',
    'persian',
    'thai',
] as const

const RenderTypeEntrySchema = z.object({ type: z.string() })

const OptionSchema = z.object({
    id: z.string(),
    code: z.string(),
    displayName: z.string(),
    sortOrder: z.number().default(0),
})

const DataElementSchema = z.object({
    id: z.string(),
    displayFormName: z.string(),
    displayDescription: z.string().optional(),
    valueType: z.string(),
    fieldMask: z.string().optional(),
    optionSetValue: z.boolean().default(false),
    optionSet: z
        .object({ id: z.string(), options: z.array(OptionSchema).default([]) })
        .optional(),
})

const ProgramStageDataElementSchema = z.object({
    compulsory: z.boolean().default(false),
    sortOrder: z.number().default(0),
    allowFutureDate: z.boolean().default(false),
    renderType: z
        .object({
            DESKTOP: RenderTypeEntrySchema.optional(),
            MOBILE: RenderTypeEntrySchema.optional(),
        })
        .optional(),
    dataElement: DataElementSchema,
})

const ProgramStageSectionSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    sortOrder: z.number().default(0),
    dataElements: z.array(z.object({ id: z.string() })).default([]),
})

const ProgramStageSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    executionDateLabel: z.string().optional(),
    validationStrategy: z.enum(VALIDATION_STRATEGIES).default('ON_COMPLETE'),
    blockEntryForm: z.boolean().default(false),
    featureType: z.enum(FEATURE_TYPES).default('NONE'),
    repeatable: z.boolean().default(false),
    sortOrder: z.number().default(0),
    programStageSections: z.array(ProgramStageSectionSchema).default([]),
    programStageDataElements: z
        .array(ProgramStageDataElementSchema)
        .default([]),
})

export const ProgramResponseSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    programType: z.string().optional(),
    trackedEntityType: z.object({ id: z.string() }).optional(),
    categoryCombo: z
        .object({ id: z.string(), isDefault: z.boolean().default(false) })
        .optional(),
    programStages: z.array(ProgramStageSchema).default([]),
})

export type ProgramResponse = z.infer<typeof ProgramResponseSchema>

export interface Section {
    id: string
    name: string
    dataElementIds: string[]
}

export interface DataElementMeta {
    id: string
    label: string
    description?: string
    valueType: string
    compulsory: boolean
    allowFutureDate: boolean
    fieldMask?: string
    options?: { id: string; code: string; label: string }[]
    renderType?: { desktop?: string; mobile?: string }
}

export interface StageMetadata {
    programId: string
    programName: string
    stage: {
        id: string
        name: string
        executionDateLabel?: string
        validationStrategy: (typeof VALIDATION_STRATEGIES)[number]
        blockEntryForm: boolean
        featureType: (typeof FEATURE_TYPES)[number]
        sections: Section[]
    }
    dataElements: Map<string, DataElementMeta>
    hasCategoryCombo: boolean
}

/** The id of the section holding every data element of a stage without sections. */
export const DEFAULT_SECTION_ID = '__default'

type StageResponse = z.infer<typeof ProgramStageSchema>
type StageDataElementResponse = z.infer<typeof ProgramStageDataElementSchema>

const bySortOrder = <T extends { sortOrder: number }>(items: T[]): T[] =>
    // Array.prototype.sort is stable, so equal sort orders keep API order.
    [...items].sort((a, b) => a.sortOrder - b.sortOrder)

const toDataElementMeta = (
    entry: StageDataElementResponse
): DataElementMeta => {
    const { dataElement, renderType } = entry
    const options = dataElement.optionSet
        ? bySortOrder(dataElement.optionSet.options).map((option) => ({
              id: option.id,
              code: option.code,
              label: option.displayName,
          }))
        : undefined
    const render = renderType && {
        ...(renderType.DESKTOP && { desktop: renderType.DESKTOP.type }),
        ...(renderType.MOBILE && { mobile: renderType.MOBILE.type }),
    }
    return {
        id: dataElement.id,
        label: dataElement.displayFormName,
        ...(dataElement.displayDescription !== undefined && {
            description: dataElement.displayDescription,
        }),
        valueType: dataElement.valueType,
        compulsory: entry.compulsory,
        allowFutureDate: entry.allowFutureDate,
        ...(dataElement.fieldMask !== undefined && {
            fieldMask: dataElement.fieldMask,
        }),
        ...(options !== undefined && { options }),
        ...(render !== undefined &&
            Object.keys(render).length > 0 && { renderType: render }),
    }
}

const toSections = (
    stage: StageResponse,
    dataElementIds: string[]
): Section[] => {
    if (stage.programStageSections.length === 0) {
        return [
            {
                id: DEFAULT_SECTION_ID,
                name: stage.displayName,
                dataElementIds,
            },
        ]
    }
    const known = new Set(dataElementIds)
    return bySortOrder(stage.programStageSections).map((section) => ({
        id: section.id,
        name: section.displayName,
        dataElementIds: section.dataElements
            .map((dataElement) => dataElement.id)
            .filter((id) => known.has(id)),
    }))
}

/** Narrows the program response to one stage; a missing stage is an error, not a throw. */
export const toStageMetadata = (
    program: ProgramResponse,
    stageId: string
): Result<StageMetadata, EventFormApiError> => {
    const stage = program.programStages.find(({ id }) => id === stageId)
    if (stage === undefined) {
        return Result.err(
            new EventFormApiError(
                'not-found',
                `Program ${program.id} has no stage ${stageId}`
            )
        )
    }
    const entries = bySortOrder(stage.programStageDataElements)
    const dataElements = new Map(
        entries.map((entry) => [entry.dataElement.id, toDataElementMeta(entry)])
    )
    return Result.ok({
        programId: program.id,
        programName: program.displayName,
        stage: {
            id: stage.id,
            name: stage.displayName,
            ...(stage.executionDateLabel !== undefined && {
                executionDateLabel: stage.executionDateLabel,
            }),
            validationStrategy: stage.validationStrategy,
            blockEntryForm: stage.blockEntryForm,
            featureType: stage.featureType,
            sections: toSections(stage, [...dataElements.keys()]),
        },
        dataElements,
        hasCategoryCombo:
            program.categoryCombo !== undefined &&
            !program.categoryCombo.isDefault,
    })
}

const GeometrySchema = z.union([
    z.object({
        type: z.literal('Point'),
        coordinates: z.tuple([z.number(), z.number()]),
    }),
    z.object({
        type: z.literal('Polygon'),
        coordinates: z.array(z.array(z.tuple([z.number(), z.number()]))),
    }),
])

const NoteSchema = z.object({
    note: z.string(),
    value: z.string(),
    storedAt: z.string(),
    createdBy: z
        .object({
            uid: z.string(),
            username: z.string().optional(),
            displayName: z.string().optional(),
        })
        .optional(),
})

export const TrackerEventSchema = z.object({
    event: z.string(),
    program: z.string(),
    programStage: z.string(),
    enrollment: z.string().optional(),
    orgUnit: z.string(),
    status: z.enum(EVENT_STATUSES),
    occurredAt: z.string().optional(),
    scheduledAt: z.string().optional(),
    geometry: GeometrySchema.optional(),
    dataValues: z
        .array(z.object({ dataElement: z.string(), value: z.string() }))
        .default([]),
    notes: z.array(NoteSchema).default([]),
})

export type TrackerEvent = z.infer<typeof TrackerEventSchema>

const DateFormatSchema = z
    .enum([
        'YYYY-MM-DD',
        'DD-MM-YYYY',
        'yyyy-MM-dd',
        'dd-MM-yyyy',
        'yyyy-mm-dd',
        'dd-mm-yyyy',
    ])
    .transform((value): 'YYYY-MM-DD' | 'DD-MM-YYYY' =>
        value.toLowerCase().startsWith('dd') ? 'DD-MM-YYYY' : 'YYYY-MM-DD'
    )

/** The calendar and date format of the DHIS2 instance, as Working List reads them from `system/info`. */
export const SystemCalendarSchema = z.object({
    calendar: z.enum(CALENDARS),
    dateFormat: DateFormatSchema,
})

export type SystemCalendar = z.infer<typeof SystemCalendarSchema>

/** The organisation units the user captures data for: the roots of the organisation unit picker. */
export const CaptureOrgUnitsSchema = z
    .object({
        organisationUnits: z.array(z.object({ id: z.string() })).default([]),
    })
    .transform(({ organisationUnits }) => organisationUnits.map(({ id }) => id))
