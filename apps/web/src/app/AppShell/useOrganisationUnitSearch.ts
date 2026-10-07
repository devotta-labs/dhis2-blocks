import { useInfiniteQuery } from '@tanstack/react-query'
import type { createAppWorkingListClient } from './createAppWorkingListClient'
import {
    OrganisationUnitsResponseSchema,
    retryOperationalError,
} from './contextSchemas'

const PAGE_SIZE = 50

export const useOrganisationUnitSearch = ({
    client,
    search,
    enabled,
}: {
    client: ReturnType<typeof createAppWorkingListClient>
    search: string
    enabled: boolean
}) =>
    useInfiniteQuery({
        queryKey: ['working-list', 'shell', 'org-unit-search', search],
        queryFn: ({ signal, pageParam }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    params: {
                        fields: 'id,displayName,path',
                        paging: true,
                        query: search,
                        // The picker only offers capture-scope units, so
                        // search inside the user's capture hierarchy rather
                        // than the wider Tracker search hierarchy.
                        withinUserHierarchy: true,
                        page: pageParam,
                        pageSize: PAGE_SIZE,
                    },
                },
                OrganisationUnitsResponseSchema,
                signal
            ),
        initialPageParam: 1,
        getNextPageParam: (lastPage) =>
            lastPage.pager &&
            lastPage.pager.page * lastPage.pager.pageSize < lastPage.pager.total
                ? lastPage.pager.page + 1
                : undefined,
        enabled: enabled && Boolean(search),
        staleTime: 5 * 60 * 1000,
        gcTime: 30 * 60 * 1000,
        retry: retryOperationalError,
    })
