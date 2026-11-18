import { queryOptions } from '@tanstack/react-query'
import type { AppClient } from './appClient'
import {
    retryOperationalError,
    TrackerProgramsResponseSchema,
} from './contextSchemas'

export const trackerProgramsQueryOptions = (
    client: AppClient,
    apiVersion: number
) =>
    queryOptions({
        queryKey: ['app-shell', 'programs', apiVersion] as const,
        queryFn: ({ signal }) =>
            client.query(
                {
                    resource: 'programs',
                    params: {
                        fields: 'id,displayName,programType,access,style[color,icon],organisationUnits[id,displayName,path]',
                        paging: false,
                        filter: 'programType:eq:WITH_REGISTRATION',
                    },
                },
                TrackerProgramsResponseSchema,
                signal
            ),
        staleTime: 60 * 60_000,
        gcTime: 4 * 60 * 60_000,
        retry: retryOperationalError,
    })
