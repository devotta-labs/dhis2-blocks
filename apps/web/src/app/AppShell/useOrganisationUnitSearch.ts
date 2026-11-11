import { useDataEngine } from '@dhis2/app-runtime'
import { useInfiniteQuery } from '@tanstack/react-query'
import {
    OrganisationUnitsResponseSchema,
    retryOperationalError,
} from './contextSchemas'

const PAGE_SIZE = 50

export const useOrganisationUnitSearch = ({
    search,
    enabled,
}: {
    search: string
    enabled: boolean
}) => {
    const engine = useDataEngine()
    return useInfiniteQuery({
        queryKey: ['working-list', 'shell', 'org-unit-search', search],
        queryFn: async ({ signal, pageParam }) => {
            const { organisationUnits } = await engine.query(
                {
                    organisationUnits: {
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
                },
                { signal }
            )
            return OrganisationUnitsResponseSchema.parse(organisationUnits)
        },
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
}
