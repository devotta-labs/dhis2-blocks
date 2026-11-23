import { Result } from 'better-result'
import type { OrgUnitResourceClient, ResourceRequest } from './client'
import { ByIdSchema, MeSchema, SearchSchema } from './schemas'

export const SEARCH_PAGE_SIZE = 20

export const FRESH_MS = 5 * 60_000

/** Unwraps a Result so React Query owns the error state. */
export const unwrap = <T>(result: Result<T, Error>) => {
    if (Result.isError(result)) {
        throw result.error
    }
    return result.value
}

const ORG_UNIT_FIELDS = 'id,displayName,displayShortName,path'

/** The user's id and assigned units; a unit with children is a district, not a facility. */
export const fetchMe = async (
    client: OrgUnitResourceClient,
    signal?: AbortSignal
) => {
    const result = await client.query(
        {
            resource: 'me',
            params: {
                fields: `id,organisationUnits[${ORG_UNIT_FIELDS},children::isNotEmpty]`,
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
export const searchOrgUnits = (
    client: OrgUnitResourceClient,
    query: string,
    page: number,
    signal?: AbortSignal
) => {
    const params: ResourceRequest['params'] = {
        withinUserHierarchy: true,
        fields: ORG_UNIT_FIELDS,
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
export const fetchOrgUnitsById = (
    client: OrgUnitResourceClient,
    ids: string[],
    signal?: AbortSignal
) =>
    client.query(
        {
            resource: 'organisationUnits',
            params: {
                filter: `id:in:[${ids.join(',')}]`,
                withinUserHierarchy: true,
                fields: ORG_UNIT_FIELDS,
                paging: false,
            },
        },
        ByIdSchema,
        signal
    )
