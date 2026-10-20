import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import type { createAppWorkingListClient } from '../../AppShell/createAppWorkingListClient'
import { retryOperationalError } from '../../AppShell/contextSchemas'

type Client = ReturnType<typeof createAppWorkingListClient>

const Reference = z.object({ id: z.string().min(1) }).passthrough()
const Labelled = Reference.extend({ displayFormName: z.string().optional() })

const StageSchema = z
    .object({
        programStageSections: z
            .array(
                Reference.extend({
                    displayName: z.string().optional(),
                    sortOrder: z.number().optional(),
                    dataElements: z.array(Reference).default([]),
                })
            )
            .default([]),
        programStageDataElements: z
            .array(
                z
                    .object({
                        sortOrder: z.number().optional(),
                        dataElement: Labelled,
                    })
                    .passthrough()
            )
            .default([]),
    })
    .passthrough()

const ProgramSchema = z
    .object({
        programTrackedEntityAttributes: z
            .array(z.object({ trackedEntityAttribute: Labelled }).passthrough())
            .default([]),
    })
    .passthrough()

const RulesSchema = z
    .object({
        programRules: z.array(
            Reference.extend({
                displayName: z.string(),
                condition: z.string().optional(),
                programRuleActions: z
                    .array(
                        z
                            .object({ programRuleActionType: z.string() })
                            .passthrough()
                    )
                    .default([]),
            })
        ),
    })
    .passthrough()

const VariablesSchema = z
    .object({
        programRuleVariables: z.array(
            z
                .object({
                    name: z.string(),
                    dataElement: Reference.optional(),
                    trackedEntityAttribute: Reference.optional(),
                })
                .passthrough()
        ),
    })
    .passthrough()

interface LensSection {
    id: string
    name?: string
    fieldIds: string[]
}

interface LensRule {
    name: string
    condition: string
    actionTypes: string[]
}

export interface LensMetadata {
    /** The stage's sections in form order; one unnamed section for fields outside any. */
    sections: LensSection[]
    /** Data element and program attribute labels by id. */
    labels: Map<string, string>
    /** Every rule of the program, so a rule that is not acting still has a name. */
    rules: Map<string, LensRule>
    /** Program rule variable name → the field it reads. */
    variables: Map<string, string>
}

const bySortOrder = (a: { sortOrder?: number }, b: { sortOrder?: number }) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0)

/**
 * The metadata the lens needs and the rule hook does not give: field labels, the stage's
 * sections, rule names, conditions and action types, and which field each variable reads.
 */
export const useLensMetadata = (
    client: Client,
    programId: string,
    programStageId: string
) =>
    useQuery({
        queryKey: ['event-form-demo', 'rules-lens', programId, programStageId],
        queryFn: async ({ signal }): Promise<LensMetadata> => {
            const programFilter = `program.id:eq:${programId}`
            const [stage, program, rules, variables] = await Promise.all([
                client.query(
                    {
                        resource: 'programStages',
                        id: programStageId,
                        params: {
                            fields: 'programStageSections[id,displayName,sortOrder,dataElements[id]],programStageDataElements[sortOrder,dataElement[id,displayFormName]]',
                        },
                    },
                    StageSchema,
                    signal
                ),
                client.query(
                    {
                        resource: 'programs',
                        id: programId,
                        params: {
                            fields: 'programTrackedEntityAttributes[trackedEntityAttribute[id,displayFormName]]',
                        },
                    },
                    ProgramSchema,
                    signal
                ),
                client.query(
                    {
                        resource: 'programRules',
                        params: {
                            filter: programFilter,
                            fields: 'id,displayName,condition,programRuleActions[programRuleActionType]',
                            paging: false,
                        },
                    },
                    RulesSchema,
                    signal
                ),
                client.query(
                    {
                        resource: 'programRuleVariables',
                        params: {
                            filter: programFilter,
                            fields: 'name,dataElement[id],trackedEntityAttribute[id]',
                            paging: false,
                        },
                    },
                    VariablesSchema,
                    signal
                ),
            ])

            const stageFields = [...stage.programStageDataElements]
                .sort(bySortOrder)
                .map((entry) => entry.dataElement)
            const sections: LensSection[] = [...stage.programStageSections]
                .sort(bySortOrder)
                .map((section) => ({
                    id: section.id,
                    name: section.displayName,
                    fieldIds: section.dataElements.map((de) => de.id),
                }))
            const sectioned = new Set(sections.flatMap((s) => s.fieldIds))
            const loose = stageFields
                .map((field) => field.id)
                .filter((id) => !sectioned.has(id))
            if (loose.length > 0) {
                sections.push({ id: 'unsectioned', fieldIds: loose })
            }

            const labelled = [
                ...stageFields,
                ...program.programTrackedEntityAttributes.map(
                    (entry) => entry.trackedEntityAttribute
                ),
            ]
            const variableFields = new Map<string, string>()
            for (const variable of variables.programRuleVariables) {
                const fieldId =
                    variable.dataElement?.id ??
                    variable.trackedEntityAttribute?.id
                if (fieldId !== undefined) {
                    variableFields.set(variable.name, fieldId)
                }
            }
            return {
                sections,
                labels: new Map(
                    labelled.map((field) => [
                        field.id,
                        field.displayFormName ?? field.id,
                    ])
                ),
                rules: new Map(
                    rules.programRules.map((rule) => [
                        rule.id,
                        {
                            name: rule.displayName,
                            condition: rule.condition ?? '',
                            actionTypes: rule.programRuleActions.map(
                                (action) => action.programRuleActionType
                            ),
                        },
                    ])
                ),
                variables: variableFields,
            }
        },
        staleTime: 5 * 60 * 1000,
        retry: retryOperationalError,
    })
