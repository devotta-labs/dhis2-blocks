import { Result } from 'better-result'
import type { z } from 'zod'
import type { ClinicResourceClient, ResourceRequest } from './client'
import { ByIdSchema, MeSchema, SearchSchema, type Clinic } from './schemas'

export const SEARCH_PAGE_SIZE = 20
// A user's units rarely change mid-session, so returning to the tab does not ask for every loaded page again.
export const FRESH_MS = 5 * 60_000

type Me = z.output<typeof MeSchema>
type SearchResult = z.output<typeof SearchSchema>

/** Unwraps a Result so React Query owns the error state. */
export const unwrap = <T>(result: Result<T, Error>): T => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const CLINIC_FIELDS = 'id,displayName,path'

/** The user's id and assigned units; a unit with children is a district, not a facility. */
export const fetchMe = async (
    client: ClinicResourceClient,
    signal?: AbortSignal
): Promise<Result<Me, Error>> => {
    const result = await client.query(
        {
            resource: 'me',
            params: {
                fields: 'id,organisationUnits[id,displayName,path,children::isNotEmpty]',
            },
        },
        MeSchema,
        signal
    )
    return result.map((me) => ({
        ...me,
        assigned: [...me.assigned].sort((a, b) =>
            a.displayName.localeCompare(b.displayName)
        ),
    }))
}

/** One page of the user's hierarchy by name, narrowed by `query` unless it is blank; `hasMore` says a page follows. */
export const searchClinics = (
    client: ClinicResourceClient,
    query: string,
    page: number,
    signal?: AbortSignal
): Promise<Result<SearchResult, Error>> => {
    const params: ResourceRequest['params'] = {
        withinUserHierarchy: true,
        fields: CLINIC_FIELDS,
        order: 'displayName:asc',
        pageSize: SEARCH_PAGE_SIZE,
        page,
    }
    if (query !== '') {
        params.query = query
    }
    return client.query(
        { resource: 'organisationUnits', params },
        SearchSchema,
        signal
    )
}

/** Remembered ids are checked against the hierarchy, so a unit the user lost access to drops out. */
export const fetchClinicsById = (
    client: ClinicResourceClient,
    ids: string[],
    signal?: AbortSignal
): Promise<Result<Clinic[], Error>> =>
    client.query(
        {
            resource: 'organisationUnits',
            params: {
                filter: `id:in:[${ids.join(',')}]`,
                withinUserHierarchy: true,
                fields: CLINIC_FIELDS,
                paging: false,
            },
        },
        ByIdSchema,
        signal
    )
