import type { useDataEngine } from '@dhis2/app-runtime'
import { queryOptions } from '@tanstack/react-query'
import type { PatientListPage, PatientListQuery } from '../types'
import { toTrackerParams } from './params'
import { shouldRetryPatientListRequest, toRequestError } from './requestErrors'
import { PatientListResponseSchema, toPatientListPage } from './schemas'

export type PatientListEngine = Pick<ReturnType<typeof useDataEngine>, 'query'>

export const patientListKeys = {
    all: ['patient-list'] as const,
    list: (server: string, apiVersion: number, query: PatientListQuery) =>
        [
            ...patientListKeys.all,
            'list',
            server,
            apiVersion,
            toTrackerParams(query, apiVersion),
        ] as const,
}

export const patientListQueryOptions = (
    engine: PatientListEngine,
    server: string,
    apiVersion: number,
    query: PatientListQuery
) =>
    queryOptions({
        queryKey: patientListKeys.list(server, apiVersion, query),
        queryFn: async ({ signal }): Promise<PatientListPage> => {
            try {
                const response = await engine.query(
                    {
                        patientListResource: {
                            resource: 'tracker/trackedEntities',
                            params: toTrackerParams(query, apiVersion),
                        },
                    },
                    { signal }
                )
                return toPatientListPage(
                    PatientListResponseSchema.parse(
                        response.patientListResource
                    ),
                    query,
                    apiVersion
                )
            } catch (cause) {
                throw toRequestError(cause)
            }
        },
        staleTime: 20_000,
        gcTime: 5 * 60_000,
        retry: shouldRetryPatientListRequest,
    })
