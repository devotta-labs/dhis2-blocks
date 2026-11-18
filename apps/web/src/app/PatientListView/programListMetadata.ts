import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import type { AppClient } from '../AppShell/appClient'
import { retryOperationalError } from '../AppShell/contextSchemas'

/** What the app needs to know about one of a program's attributes to list it. */
export interface ProgramListAttribute {
    id: string
    label: string
    valueType: string
    displayInList: boolean
    searchable: boolean
    options?: ReadonlyArray<{ code: string; displayName: string }>
}

const ProgramListAttributesResponseSchema = z
    .object({
        id: z.string().min(1),
        programTrackedEntityAttributes: z.array(
            z
                .object({
                    displayInList: z.boolean().optional(),
                    searchable: z.boolean().optional(),
                    sortOrder: z.number().optional(),
                    trackedEntityAttribute: z
                        .object({
                            id: z.string().min(1),
                            displayName: z.string(),
                            displayFormName: z.string().optional(),
                            valueType: z.string().min(1),
                            optionSet: z
                                .object({
                                    options: z.array(
                                        z
                                            .object({
                                                code: z.string(),
                                                displayName: z.string(),
                                            })
                                            .passthrough()
                                    ),
                                })
                                .passthrough()
                                .optional(),
                        })
                        .passthrough(),
                })
                .passthrough()
        ),
    })
    .passthrough()

type ProgramListAttributesResponse = z.infer<
    typeof ProgramListAttributesResponseSchema
>

const FIELDS =
    'id,programTrackedEntityAttributes[displayInList,searchable,sortOrder,trackedEntityAttribute[id,displayName,displayFormName,valueType,optionSet[options[code,displayName]]]]'

const toProgramListAttributes = ({
    programTrackedEntityAttributes,
}: ProgramListAttributesResponse): ProgramListAttribute[] =>
    programTrackedEntityAttributes
        .toSorted(
            (a, b) =>
                (a.sortOrder ?? Number.MAX_SAFE_INTEGER) -
                (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        )
        .map(
            ({
                displayInList,
                searchable,
                trackedEntityAttribute: attribute,
            }) => ({
                id: attribute.id,
                label: attribute.displayFormName ?? attribute.displayName,
                valueType: attribute.valueType,
                displayInList: displayInList ?? false,
                searchable: searchable ?? false,
                options: attribute.optionSet?.options.map(
                    ({ code, displayName }) => ({ code, displayName })
                ),
            })
        )

export const programListAttributesQueryOptions = (
    client: AppClient,
    programId: string
) =>
    queryOptions({
        queryKey: ['app-shell', 'program-list-attributes', programId] as const,
        queryFn: async ({ signal }) =>
            toProgramListAttributes(
                await client.query(
                    {
                        resource: 'programs',
                        id: programId,
                        params: { fields: FIELDS },
                    },
                    ProgramListAttributesResponseSchema,
                    signal
                )
            ),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: retryOperationalError,
    })
