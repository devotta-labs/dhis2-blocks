import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import {
    keepPreviousData,
    useQuery,
    type UseQueryResult,
} from '@tanstack/react-query'
import { patientListQueryOptions } from './api/queries'
import type { PatientListPage, PatientListQuery } from './types'

export interface UsePatientListQueryOptions {
    /** Default true. */
    enabled?: boolean
    /** Keep showing the previous page while the next one loads. Default true. */
    keepPrevious?: boolean
}

/** One page of tracked entities for `query`, through the DHIS2 data engine. */
export const usePatientListQuery = (
    query: PatientListQuery,
    options: UsePatientListQueryOptions = {}
): UseQueryResult<PatientListPage, Error> => {
    const { enabled = true, keepPrevious = true } = options
    const engine = useDataEngine()
    const { baseUrl, apiVersion } = useConfig()
    return useQuery({
        ...patientListQueryOptions(engine, baseUrl, apiVersion, query),
        enabled,
        placeholderData: keepPrevious ? keepPreviousData : undefined,
    })
}
