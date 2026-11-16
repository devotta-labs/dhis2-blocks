import type { Result } from 'better-result'
import type { ClinicResourceClient, ResourceRequest } from './client'
import {
    ByIdSchema,
    MeSchema,
    SearchSchema,
    type AssignedClinic,
    type Clinic,
} from './schemas'

export const SEARCH_PAGE_SIZE = 20

export interface Me {
    userId: string
    assigned: AssignedClinic[]
}

export interface SearchResult {
    clinics: Clinic[]
    hasMore: boolean
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
