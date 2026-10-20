import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { retryOperationalError } from '../AppShell/contextSchemas'
import type { createAppWorkingListClient } from '../AppShell/createAppWorkingListClient'
import type { GraphLabels } from './graphModel'

type Client = ReturnType<typeof createAppWorkingListClient>

const STALE_TIME = 5 * 60 * 1000

const ProgramsSchema = z
    .object({
        programs: z.array(
            z
                .object({ id: z.string().min(1), displayName: z.string() })
                .passthrough()
        ),
    })
    .passthrough()

/** Every program the user can see, event programs included: both can have rules. */
export const usePrograms = (client: Client) =>
    useQuery({
        queryKey: ['program-rules-graph', 'programs'],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    params: {
                        fields: 'id,displayName',
                        order: 'displayName:asc',
                        pageSize: 1000,
                    },
                },
                ProgramsSchema,
                signal
            ),
        select: (data) => data.programs,
        staleTime: STALE_TIME,
        retry: retryOperationalError,
    })

const NamedSchema = z
    .object({
        id: z.string().min(1),
        displayName: z.string(),
        displayFormName: z.string().optional(),
    })
    .passthrough()

const ProgramLabelsSchema = z
    .object({
        programStages: z.array(
            z
                .object({
                    id: z.string().min(1),
                    displayName: z.string(),
                    programStageDataElements: z
                        .array(
                            z.object({ dataElement: NamedSchema }).passthrough()
                        )
                        .optional(),
                    programStageSections: z.array(NamedSchema).optional(),
                })
                .passthrough()
        ),
        programTrackedEntityAttributes: z
            .array(
                z.object({ trackedEntityAttribute: NamedSchema }).passthrough()
            )
            .optional(),
    })
    .passthrough()

export interface ProgramLabels extends GraphLabels {
    stages: { id: string; name: string }[]
    /** programStageId → the data elements of the stage */
    stageFields: Map<string, Set<string>>
}

const formName = (named: z.infer<typeof NamedSchema>) =>
    named.displayFormName ?? named.displayName

// Module level, so React Query keeps the selected Maps between renders.
const toProgramLabels = (
    data: z.infer<typeof ProgramLabelsSchema>
): ProgramLabels => {
    const stages = data.programStages
    const dataElements = stages.flatMap((stage) =>
        (stage.programStageDataElements ?? []).map((p) => p.dataElement)
    )
    const attributes = (data.programTrackedEntityAttributes ?? []).map(
        (p) => p.trackedEntityAttribute
    )
    return {
        stages: stages.map((stage) => ({
            id: stage.id,
            name: stage.displayName,
        })),
        stageFields: new Map(
            stages.map((stage) => [
                stage.id,
                new Set(
                    (stage.programStageDataElements ?? []).map(
                        (p) => p.dataElement.id
                    )
                ),
            ])
        ),
        fields: new Map(
            [...dataElements, ...attributes].map((field) => [
                field.id,
                formName(field),
            ])
        ),
        sections: new Map(
            stages.flatMap((stage) =>
                (stage.programStageSections ?? []).map((section) => [
                    section.id,
                    section.displayName,
                ])
            )
        ),
    }
}

/**
 * Stage, data element, attribute and section names for a program. The rule
 * metadata speaks in ids; these make the graph and the rules lens readable.
 */
export const useProgramLabels = (client: Client, programId?: string) =>
    useQuery({
        queryKey: ['program-rules-graph', 'labels', programId],
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    id: programId,
                    params: {
                        fields: [
                            'programStages[id,displayName,programStageDataElements[dataElement[id,displayName,displayFormName]],programStageSections[id,displayName]]',
                            'programTrackedEntityAttributes[trackedEntityAttribute[id,displayName,displayFormName]]',
                        ].join(','),
                    },
                },
                ProgramLabelsSchema,
                signal
            ),
        select: toProgramLabels,
        enabled: Boolean(programId),
        staleTime: STALE_TIME,
        retry: retryOperationalError,
    })
