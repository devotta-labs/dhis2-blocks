import { FetchError, useDataEngine } from '@dhis2/app-runtime'
import { useQuery } from '@tanstack/react-query'
import { ZodError } from 'zod'
import { fetchRuleEnrollment } from './enrollment'
import { fetchOrgUnitGroups, fetchProgramRulesMetadata } from './metadata'
import { programRulesQueryKeys } from './queryKeys'

const HOUR = 60 * 60_000

/** Malformed responses and client errors are deterministic; other failures get two retries. */
export const shouldRetryProgramRulesRequest = (
    failureCount: number,
    error: Error
): boolean => {
    if (failureCount >= 2 || error instanceof ZodError) {
        return false
    }
    if (error instanceof FetchError) {
        const status = error.details.httpStatusCode
        return (
            error.type !== 'access' && (status === undefined || status >= 500)
        )
    }
    return true
}

/** The program's rule metadata: one cached query for every hook of the program. */
export const useRuleMetadataQuery = (programId: string, enabled: boolean) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: programRulesQueryKeys.metadata(programId),
        queryFn: ({ signal }) =>
            fetchProgramRulesMetadata(engine, programId, signal),
        enabled,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
}

/** The org unit groups the rules name; nothing is asked for while they name none. */
export const useOrgUnitGroupsQuery = (
    groups: ReadonlyArray<string>,
    enabled: boolean
) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: programRulesQueryKeys.orgUnitGroups(groups),
        queryFn: ({ signal }) => fetchOrgUnitGroups(engine, groups, signal),
        enabled: enabled && groups.length > 0,
        staleTime: HOUR,
        retry: shouldRetryProgramRulesRequest,
    })
}

/** One enrollment as rule input, with its events when the rules read them. */
export const useRuleEnrollmentQuery = (
    enrollmentId: string,
    withEvents: boolean,
    enabled: boolean
) => {
    const engine = useDataEngine()
    return useQuery({
        queryKey: programRulesQueryKeys.enrollment(enrollmentId, withEvents),
        queryFn: ({ signal }) =>
            fetchRuleEnrollment(engine, enrollmentId, withEvents, signal),
        enabled,
        staleTime: 60_000,
        retry: shouldRetryProgramRulesRequest,
    })
}
