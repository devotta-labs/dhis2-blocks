import { z } from 'zod'
import type {
    DataElementMetadata,
    StageMetadata,
    TrackerEventRecord,
} from './types'

const LegendSchema = z
    .object({
        name: z.string(),
        color: z.string(),
        startValue: z.number(),
        endValue: z.number(),
    })
    .passthrough()

const OptionSchema = z
    .object({
        code: z.string(),
        name: z.string(),
        style: z
            .object({
                color: z
                    .string()
                    .nullish()
                    .transform((c) => c ?? undefined),
            })
            .passthrough()
            .nullish()
            .transform((s) => s ?? undefined),
    })
    .passthrough()

const DataElementSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        displayFormName: z
            .string()
            .nullish()
            .transform((n) => n ?? undefined),
        valueType: z.string(),
        legendSets: z
            .array(z.object({ legends: z.array(LegendSchema) }).passthrough())
            .nullish()
            .transform((sets) => sets ?? undefined),
        optionSet: z
            .object({ options: z.array(OptionSchema) })
            .passthrough()
            .nullish()
            .transform((set) => set ?? undefined),
    })
    .passthrough()

export const DataElementsResponseSchema = z
    .object({ dataElements: z.array(DataElementSchema) })
    .passthrough()
    .transform((response): DataElementMetadata[] => response.dataElements)

const ProgramStageSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        access: z
            .object({
                data: z
                    .object({ read: z.boolean().optional() })
                    .passthrough()
                    .optional(),
            })
            .passthrough()
            .optional(),
        programStageDataElements: z
            .array(
                z
                    .object({
                        dataElement: z
                            .object({ id: z.string().min(1) })
                            .passthrough(),
                    })
                    .passthrough()
            )
            .default([]),
    })
    .passthrough()

export const ProgramStagesResponseSchema = z
    .object({ programStages: z.array(ProgramStageSchema).default([]) })
    .passthrough()
    .transform((program): StageMetadata[] =>
        program.programStages.map((stage) => ({
            id: stage.id,
            displayName: stage.displayName,
            // The request asks for access[data[read]]. A server that does not
            // report it (older versions) is not denying anything, so an absent
            // field means readable; only an explicit `false` hides data.
            canReadData: stage.access?.data?.read ?? true,
            dataElementIds: stage.programStageDataElements.map(
                (entry) => entry.dataElement.id
            ),
        }))
    )

const DataValueSchema = z
    .object({ dataElement: z.string(), value: z.string().nullish() })
    .passthrough()

const EventSchema = z
    .object({
        event: z.string().min(1),
        trackedEntity: z.string().optional(),
        programStage: z.string(),
        status: z.string(),
        // Kept as received; buildSeries parses them.
        occurredAt: z.string().optional(),
        createdAt: z.string().optional(),
        // A value without a value is skipped, so one bad entry cannot fail
        // the whole response.
        dataValues: z
            .array(DataValueSchema)
            .default([])
            .transform((dataValues) =>
                dataValues.flatMap(({ dataElement, value }) =>
                    value === null || value === undefined
                        ? []
                        : [{ dataElement, value }]
                )
            ),
    })
    .passthrough()

/** Current servers return `events`; 2.41 returns the legacy `instances`. */
export const EventsResponseSchema = z
    .object({
        events: z.array(EventSchema).optional(),
        instances: z.array(EventSchema).optional(),
    })
    .passthrough()
    .superRefine((value, context) => {
        if (!value.events && !value.instances) {
            context.addIssue({
                code: 'custom',
                message: 'Tracker response requires events or legacy instances',
            })
        }
    })
    .transform(
        (response): TrackerEventRecord[] =>
            response.events ?? response.instances ?? []
    )

const EnrollmentSchema = z
    .object({ enrollment: z.string().min(1) })
    .passthrough()

/** Current servers return `enrollments`; 2.41 returns the legacy `instances`. */
export const EnrollmentsResponseSchema = z
    .object({
        enrollments: z.array(EnrollmentSchema).optional(),
        instances: z.array(EnrollmentSchema).optional(),
    })
    .passthrough()
    .superRefine((value, context) => {
        if (!value.enrollments && !value.instances) {
            context.addIssue({
                code: 'custom',
                message:
                    'Tracker response requires enrollments or legacy instances',
            })
        }
    })
    .transform(
        (response): { enrollment: string }[] =>
            response.enrollments ?? response.instances ?? []
    )
