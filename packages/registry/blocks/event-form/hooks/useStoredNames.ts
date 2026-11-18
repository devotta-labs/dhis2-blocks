import { useDataEngine } from '@dhis2/app-runtime'
import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { z } from 'zod'
import type { StageForm, Values } from '../lib/metadata'

const ORG_UNIT_TYPES = new Set(['ORGANISATION_UNIT'])
const FILE_TYPES = new Set(['FILE_RESOURCE', 'IMAGE'])

const orgUnitsSchema = z.object({
    orgUnits: z.object({
        organisationUnits: z.array(
            z.object({ id: z.string(), displayName: z.string() })
        ),
    }),
})
const fileSchema = z.object({
    file: z.object({ id: z.string(), name: z.string() }),
})

// Outside the hook, so React Query keeps the combined list while no file query changes.
const loadedFiles = (
    results: ReadonlyArray<{ data?: readonly [string, string] }>
) => results.flatMap(({ data }) => (data === undefined ? [] : [data]))

const storedOf = (
    form: StageForm,
    values: Values,
    types: ReadonlySet<string>
) =>
    [
        ...new Set(
            Object.entries(values)
                .filter(([fieldId]) =>
                    types.has(form.fields.get(fieldId)?.field.valueType ?? '')
                )
                .map(([, value]) => value)
        ),
    ].sort()

/** The names of the org units and files the values hold, by stored id. A failed request only loses its names. */
export const useStoredNames = (
    form: StageForm,
    values: Values
): ReadonlyMap<string, string> => {
    const engine = useDataEngine()
    const orgUnitIds = storedOf(form, values, ORG_UNIT_TYPES)
    const orgUnits = useQuery({
        queryKey: ['event-form', 'org-unit-names', orgUnitIds],
        queryFn: async ({ signal }) =>
            orgUnitsSchema
                .parse(
                    await engine.query(
                        {
                            orgUnits: {
                                resource: 'organisationUnits',
                                params: {
                                    filter: `id:in:[${orgUnitIds.join(',')}]`,
                                    fields: 'id,displayName',
                                    paging: false,
                                },
                            },
                        },
                        { signal }
                    )
                )
                .orgUnits.organisationUnits.map(
                    ({ id, displayName }): [string, string] => [id, displayName]
                ),
        enabled: orgUnitIds.length > 0,
        placeholderData: keepPreviousData,
    })
    // One request per file: listing file resources needs the ALL authority.
    const files = useQueries({
        queries: storedOf(form, values, FILE_TYPES).map((id) => ({
            queryKey: ['event-form', 'file-name', id],
            queryFn: async ({ signal }: { signal: AbortSignal }) => {
                const { file } = fileSchema.parse(
                    await engine.query(
                        {
                            file: {
                                resource: 'fileResources',
                                id,
                                params: { fields: 'id,name' },
                            },
                        },
                        { signal }
                    )
                )
                return [file.id, file.name] as const
            },
        })),
        combine: loadedFiles,
    })
    return useMemo(
        () => new Map([...(orgUnits.data ?? []), ...files]),
        [orgUnits.data, files]
    )
}
