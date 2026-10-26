import { z } from 'zod'

export const PROGRAM_FIELDS =
    'id,displayName,programType,expiryPeriodType,expiryDays,completeEventsExpiryDays,categoryCombo[id,isDefault],programStages[id,displayName,repeatable,validationStrategy,blockEntryForm,access[data[write]],programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]]]'

export const EVENT_FIELDS =
    'event,enrollment,program,programStage,orgUnit,occurredAt,scheduledAt,completedAt,status,attributeOptionCombo,dataValues[dataElement,value]'

const stageSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    repeatable: z.boolean(),
    validationStrategy: z.enum(['ON_COMPLETE', 'ON_UPDATE_AND_INSERT']),
    blockEntryForm: z.boolean(),
    access: z.object({ data: z.object({ write: z.boolean() }) }),
    programStageDataElements: z.array(
        z.object({
            compulsory: z.boolean(),
            dataElement: z.object({
                id: z.string(),
                displayFormName: z.string(),
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
})

export type ProgramStage = z.infer<typeof stageSchema>

const eventSchema = z.object({
    event: z.string(),
    enrollment: z.string().optional(),
    programStage: z.string(),
    orgUnit: z.string(),
    occurredAt: z.string().optional(),
    scheduledAt: z.string().optional(),
    completedAt: z.string().optional(),
    status: z.enum([
        'ACTIVE',
        'COMPLETED',
        'SCHEDULE',
        'SKIPPED',
        'VISITED',
        'OVERDUE',
    ]),
    dataValues: z.array(
        z.object({ dataElement: z.string(), value: z.string() })
    ),
})

export type TrackerEvent = z.infer<typeof eventSchema>

/** The program with its stages, one page of its events, and the user's authorities, as one query returns them. */
export const eventFormSchema = z.object({
    program: z.object({
        id: z.string(),
        displayName: z.string(),
        programType: z.enum(['WITH_REGISTRATION', 'WITHOUT_REGISTRATION']),
        expiryPeriodType: z.string().optional(),
        expiryDays: z.number().optional(),
        completeEventsExpiryDays: z.number().optional(),
        categoryCombo: z.object({ id: z.string(), isDefault: z.boolean() }),
        programStages: z.array(stageSchema),
    }),
    events: z.object({ events: z.array(eventSchema) }),
    me: z.object({ authorities: z.array(z.string()) }),
})
