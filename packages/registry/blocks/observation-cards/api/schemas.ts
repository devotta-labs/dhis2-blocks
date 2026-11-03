import { z } from 'zod'
import type {
    DataElementMetadata,
    InvalidDataElement,
    ProgramMetadata,
    TrackerEventRecord,
} from './types'

const LegendSchema = z
    .object({
        name: z.string(),
        color: z
            .string()
            .nullish()
            .transform((c) => c ?? undefined),
        startValue: z.number(),
        endValue: z.number(),
    })
    .passthrough()

/** A malformed legend is dropped on its own, so the rest of its set still applies. */
const LegendsSchema = z.array(z.unknown()).transform((legends) =>
    legends.flatMap((legend) => {
        const parsed = LegendSchema.safeParse(legend)
        return parsed.success ? [parsed.data] : []
    })
)

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
            .array(z.object({ legends: LegendsSchema }).passthrough())
            .nullish()
            .transform((sets) => sets ?? undefined),
        // Never dropped when malformed: the card would show raw option codes.
        optionSet: z
            .object({ options: z.array(OptionSchema) })
            .passthrough()
            .nullish()
            .transform((set) => set ?? undefined),
    })
    .passthrough()

/** Only the id, so one element's bad metadata errors its own card, not the program. */
const DataElementRefSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string().optional().catch(undefined),
    })
    .passthrough()

type ReadDataElement =
    | { id: string; metadata: DataElementMetadata }
    | { id: string; invalid: InvalidDataElement }

const readDataElement = (
    dataElement: z.output<typeof DataElementRefSchema>
): ReadDataElement => {
    const { id, displayName } = dataElement
    const parsed = DataElementSchema.safeParse(dataElement)
    return parsed.success
        ? { id, metadata: parsed.data }
        : {
              id,
              invalid: {
                  displayName,
                  error: new Error(
                      `Data element ${id} has metadata this card can't read: ${z.prettifyError(parsed.error)}`
                  ),
              },
          }
}

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
        // An entry without an id is dropped: no card can ask for it.
        programStageDataElements: z
            .array(z.unknown())
            .default([])
            .transform((entries) =>
                entries.flatMap((entry) => {
                    const parsed = z
                        .object({ dataElement: DataElementRefSchema })
                        .safeParse(entry)
                    return parsed.success
                        ? [readDataElement(parsed.data.dataElement)]
                        : []
                })
            ),
    })
    .passthrough()

/** `programs/<id>`: the stages and, nested in them, the data elements. */
export const ProgramMetadataResponseSchema = z
    .object({ programStages: z.array(ProgramStageSchema).default([]) })
    .passthrough()
    .transform((program): ProgramMetadata => {
        const read = program.programStages.flatMap(
            (stage) => stage.programStageDataElements
        )
        return {
            stages: program.programStages.map((stage) => ({
                id: stage.id,
                displayName: stage.displayName,
                // The request asks for access[data[read]]. A server that does
                // not report it (older versions) is not denying anything, so
                // an absent field means readable; only an explicit `false`
                // hides data.
                canReadData: stage.access?.data?.read ?? true,
                dataElementIds: stage.programStageDataElements.map(
                    (entry) => entry.id
                ),
            })),
            // A data element several stages capture is kept once.
            dataElements: new Map(
                read.flatMap((entry): [string, DataElementMetadata][] =>
                    'metadata' in entry ? [[entry.id, entry.metadata]] : []
                )
            ),
            invalidDataElements: new Map(
                read.flatMap((entry): [string, InvalidDataElement][] =>
                    'invalid' in entry ? [[entry.id, entry.invalid]] : []
                )
            ),
        }
    })

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
