import i18n from '@dhis2/d2-i18n'
import { z } from 'zod'
import type { Field } from '@/components/dhis2-value-types'
import { dataElementSchema, optionSetSchema } from '../sources/eventSchemas'
import { fieldOf } from '../sources/fieldOf'

/** What a register needs of its program, for its layout and its edit rules: one query's fields. */
export const REGISTER_PROGRAM_FIELDS =
    'id,displayName,displayIncidentDate,displayEnrollmentDateLabel,displayIncidentDateLabel,expiryPeriodType,expiryDays,completeEventsExpiryDays,access[data[write]],categoryCombo[isDefault],trackedEntityType[id,access[data[write]]],programTrackedEntityAttributes[mandatory,trackedEntityAttribute[id,displayFormName,valueType,fieldMask,generated,unique,optionSet[options[code,displayName]]]],programStages[id,displayName,repeatable,validationStrategy,autoGenerateEvent,minDaysFromStart,generatedByEnrollmentDate,reportDateToUse,openAfterEnrollment,blockEntryForm,access[data[write]],programStageDataElements[compulsory,dataElement[id,displayFormName,valueType,fieldMask,optionSet[options[code,displayName]]]],programStageSections[id,dataElements[id]]]'

/** The program as `REGISTER_PROGRAM_FIELDS` returns it. */
export const registerProgramSchema = z.object({
    id: z.string(),
    displayName: z.string(),
    displayIncidentDate: z.boolean().optional(),
    displayEnrollmentDateLabel: z.string().optional(),
    displayIncidentDateLabel: z.string().optional(),
    trackedEntityType: z.object({ id: z.string() }),
    programTrackedEntityAttributes: z.array(
        z.object({
            mandatory: z.boolean(),
            trackedEntityAttribute: z.object({
                id: z.string(),
                displayFormName: z.string(),
                valueType: z.string(),
                fieldMask: z.string().optional(),
                generated: z.boolean(),
                unique: z.boolean(),
                optionSet: optionSetSchema.optional(),
            }),
        })
    ),
    programStages: z.array(
        z.object({
            id: z.string(),
            displayName: z.string(),
            repeatable: z.boolean(),
            validationStrategy: z.enum(['ON_COMPLETE', 'ON_UPDATE_AND_INSERT']),
            autoGenerateEvent: z.boolean(),
            minDaysFromStart: z.number(),
            generatedByEnrollmentDate: z.boolean(),
            reportDateToUse: z
                .enum(['enrollmentDate', 'incidentDate'])
                .optional(),
            openAfterEnrollment: z.boolean(),
            programStageDataElements: z.array(
                z.object({
                    compulsory: z.boolean(),
                    dataElement: dataElementSchema,
                })
            ),
        })
    ),
})

export type RegisterProgram = z.infer<typeof registerProgramSchema>

export interface RegisterStage {
    name: string
    repeatable: boolean
    validationStrategy: 'ON_COMPLETE' | 'ON_UPDATE_AND_INSERT'
    dataElements: ReadonlyMap<
        string,
        { name: string; field: Field; compulsory: boolean }
    >
    autoGenerateEvent: boolean
    minDaysFromStart: number
    generatedByEnrollmentDate: boolean
    reportDateToUse?: 'enrollmentDate' | 'incidentDate'
    openAfterEnrollment: boolean
}

export interface RegisterMetadata {
    programId: string
    programName: string
    trackedEntityTypeId: string
    attributes: ReadonlyMap<
        string,
        {
            name: string
            field: Field
            mandatory: boolean
            generated: boolean
            unique: boolean
        }
    >
    /** Present when the program shows an incident date. */
    incidentDate?: { name: string }
    enrolmentDateName: string
    stages: ReadonlyMap<string, RegisterStage>
}

/** The parts of the program a register reads, keyed by id. */
export const registerMetadataOf = (
    program: RegisterProgram
): RegisterMetadata => ({
    programId: program.id,
    programName: program.displayName,
    trackedEntityTypeId: program.trackedEntityType.id,
    attributes: new Map(
        program.programTrackedEntityAttributes.map(
            ({ mandatory, trackedEntityAttribute: attribute }) => [
                attribute.id,
                {
                    name: attribute.displayFormName,
                    field: fieldOf(attribute),
                    mandatory,
                    generated: attribute.generated,
                    unique: attribute.unique,
                },
            ]
        )
    ),
    incidentDate: program.displayIncidentDate
        ? {
              name: program.displayIncidentDateLabel ?? i18n.t('Incident date'),
          }
        : undefined,
    enrolmentDateName:
        program.displayEnrollmentDateLabel ?? i18n.t('Enrolment date'),
    stages: new Map(
        program.programStages.map(({ programStageDataElements, ...stage }) => [
            stage.id,
            {
                ...stage,
                name: stage.displayName,
                dataElements: new Map(
                    programStageDataElements.map(
                        ({ compulsory, dataElement }) => [
                            dataElement.id,
                            {
                                name: dataElement.displayFormName,
                                field: fieldOf(dataElement),
                                compulsory,
                            },
                        ]
                    )
                ),
            },
        ])
    ),
})
