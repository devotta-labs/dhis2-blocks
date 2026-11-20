import { useConfig, useDataEngine } from '@dhis2/app-runtime'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { metadataQueryOptions, searchQueryOptions } from '../api/queries'
import type { FinderPerson } from '../api/search'
import { systemInfoQueryOptions } from '../api/systemInfo'
import { buildProgramModel } from '../rules/programModel'
import type { FinderScope } from '../rules/types'
import type {
    FinderContextValue,
    FinderStatus,
    FinderSubmission,
} from './context'
import { useSearchResults } from './useSearchResults'

const getFinderStatus = (failed: boolean, ready: boolean): FinderStatus => {
    if (failed) return 'error'
    return ready ? 'ready' : 'loading'
}

export interface FinderControllerOptions {
    scope: FinderScope
    onSelect: (person: FinderPerson) => void
}

/**
 * Holds what the finder shares across its forms: the scope's search rules,
 * the last submitted search and the page. Mount it under a `key` of the
 * scope, so a new program or tracked entity type starts from nothing.
 */
export const useFinderController = ({
    scope,
    onSelect,
}: FinderControllerOptions): FinderContextValue => {
    const engine = useDataEngine()
    const { baseUrl } = useConfig()
    const queryClient = useQueryClient()
    const metadata = useQuery(metadataQueryOptions(engine, baseUrl, scope))
    const systemInfo = useQuery(systemInfoQueryOptions(engine, baseUrl))
    // Built before system info arrives, so fields show their labels; until
    // then MULTI_TEXT counts as searchable, so an older server's error shows
    // only once it is known. Nothing searches before system info anyway.
    const multiTextSearch = systemInfo.data?.multiTextSearch ?? true
    const model = useMemo(
        () =>
            metadata.data
                ? buildProgramModel(metadata.data, { multiTextSearch })
                : undefined,
        [metadata.data, multiTextSearch]
    )
    // Dates need the server calendar, so the finder is ready only with both.
    const status = getFinderStatus(
        metadata.isError || systemInfo.isError,
        Boolean(model && systemInfo.data)
    )

    const [submission, setSubmission] = useState<FinderSubmission>()
    const [page, setPage] = useState(1)

    const results = useSearchResults({
        scope,
        model,
        status,
        submission,
        page,
    })

    const onSelectRef = useRef(onSelect)
    onSelectRef.current = onSelect
    const logged = useRef(new Set<string>())

    const submit = useCallback<FinderContextValue['actions']['submit']>(
        (search) => {
            if (model && status === 'ready') {
                // A repeated key does not remount its observer. Fetch only if stale.
                void queryClient.prefetchQuery(
                    searchQueryOptions(engine, baseUrl, model, search, 1)
                )
            }
            setSubmission((current) => ({
                search,
                id: (current?.id ?? 0) + 1,
            }))
            setPage(1)
        },
        [model, status, queryClient, engine, baseUrl]
    )

    const select = useCallback(
        (person: FinderPerson) => onSelectRef.current(person),
        []
    )

    const logMetadataError = useCallback((message: string) => {
        if (!logged.current.has(message)) {
            logged.current.add(message)
            console.error(message)
        }
    }, [])

    const actions = useMemo(
        () => ({ submit, setPage, select, logMetadataError }),
        [submit, select, logMetadataError]
    )

    return useMemo(
        () => ({
            state: {
                status,
                model,
                submission,
                page,
                results,
            },
            actions,
            meta: { scope, info: systemInfo.data },
        }),
        [
            status,
            model,
            submission,
            page,
            results,
            actions,
            scope,
            systemInfo.data,
        ]
    )
}
