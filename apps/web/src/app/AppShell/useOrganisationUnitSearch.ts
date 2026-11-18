import { useInfiniteQuery } from '@tanstack/react-query'
import type { AppClient } from './appClient'
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
    client: AppClient
    search: string
    enabled: boolean
}) =>
    useInfiniteQuery({
        queryKey: ['app-shell', 'org-unit-search', search],
        queryFn: ({ signal, pageParam }) =>
            client.query(
                {
                    resource: 'organisationUnits',
                    params: {
                        fields: 'id,displayName,path',
                        paging: true,
                        query: search,
                        withinUserSearchHierarchy: true,
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
