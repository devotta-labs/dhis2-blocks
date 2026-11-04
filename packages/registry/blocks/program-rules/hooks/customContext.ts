import { z } from 'zod'
import type { RuleEnrollmentData } from '../lib'
import type { ProgramRulesClient } from './client'
import {
    RuleEnrollmentResponseSchema,
    toRuleEnrollmentData,
} from './enrollment'
import { RuleContextDataSchema } from '../lib/customFunctions'
import type { RuleContextData } from '../lib/customFunctions'

const TrackedEntitySchema = z
    .object({
        trackedEntity: z.string(),
        attributes: z
            .array(
                z.object({
                    attribute: z.string(),
                    value: z.string().optional(),
                })
            )
            .default([]),
        enrollments: z.array(RuleEnrollmentResponseSchema).default([]),
    })
    .catchall(z.json())

/** The tracker single-object endpoint includes all accessible nested enrollments and events, without list paging. */
export const fetchCustomRulePersons = async (
    client: ProgramRulesClient,
    persons: Map<string, RuleEnrollmentData>,
    signal?: AbortSignal
): Promise<Map<string, RuleEnrollmentData>> => {
    const ids = [
        ...new Set(
            [...persons.values()].map((person) => {
                if (person.trackedEntityId === undefined) {
                    throw new Error(
                        'A tracked entity is required for custom rules'
                    )
                }
                return person.trackedEntityId
            })
        ),
    ]
    const trackedEntities = new Map<
        string,
        { model: z.infer<typeof TrackedEntitySchema>; data: RuleContextData }
    >()
    // Bound concurrency: complete tracked-entity histories can be large.
    for (let offset = 0; offset < ids.length; offset += 4) {
        await Promise.all(
            ids.slice(offset, offset + 4).map(async (id) => {
                const response = await client.query(
                    {
                        trackedEntity: {
                            resource: 'tracker/trackedEntities',
                            id,
                            params: {
                                fields: '*,enrollments[*,events[*,dataValues[*]]]',
                            },
                        },
                    },
                    z.object({ trackedEntity: RuleContextDataSchema }),
                    signal
                )
                const model = TrackedEntitySchema.parse(response.trackedEntity)
                if (model.trackedEntity !== id)
                    throw new Error(
                        'Unexpected tracked entity in custom context'
                    )
                trackedEntities.set(id, { model, data: response.trackedEntity })
            })
        )
    }
    return new Map(
        [...persons].map(([id, person]) => {
            const fetched = trackedEntities.get(person.trackedEntityId ?? '')
            if (fetched === undefined)
                throw new Error('Tracked entity history was not loaded')
            const trackedEntity = fetched.model
            const enrollments =
                trackedEntity.enrollments.map(toRuleEnrollmentData)
            if (!enrollments.some((entry) => entry.enrollment.id === id)) {
                throw new Error(
                    'The current enrollment is missing from the tracked entity context'
                )
            }
            return [
                id,
                {
                    ...person,
                    customData: {
                        trackedEntity: {
                            id: trackedEntity.trackedEntity,
                            attributes: Object.fromEntries(
                                trackedEntity.attributes.flatMap(
                                    ({ attribute, value }) =>
                                        value === undefined
                                            ? []
                                            : [[attribute, value]]
                                )
                            ),
                            data: fetched.data,
                        },
                        enrollments: enrollments.map(
                            (entry) => entry.enrollment
                        ),
                        events: enrollments.flatMap((entry) => entry.events),
                    },
                },
            ]
        })
    )
}

export const fetchCustomRuleMetadata = async (
    client: ProgramRulesClient,
    programId: string,
    signal?: AbortSignal
): Promise<RuleContextData> => {
    const response = await client.query(
        {
            program: {
                resource: 'programs',
                id: programId,
                params: {
                    fields: '*,programStages[*,programStageDataElements[*,dataElement[*]]],programTrackedEntityAttributes[*,trackedEntityAttribute[*]]',
                },
            },
        },
        z.object({ program: RuleContextDataSchema }),
        signal
    )
    return response.program
}
