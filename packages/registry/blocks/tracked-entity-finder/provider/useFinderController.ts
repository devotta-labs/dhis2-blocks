import { useQuery } from '@tanstack/react-query'
import { useCallback, useMemo, useRef, useState } from 'react'
import { resourceClientOf, type TrackedEntityFinderClient } from '../api/client'
import { programMetadataQueryOptions } from '../api/queries'
import { useTrackedEntityFinderClient } from '../api/runtimeClient'
import type { FinderPerson } from '../api/search'
import { systemInfoQueryOptions } from '../api/systemInfo'
import { buildProgramModel } from '../rules/programModel'
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
    program: string
    onSelect: (person: FinderPerson) => void
    client?: TrackedEntityFinderClient
}

/**
 * Holds what the finder shares across its forms: program metadata, the last
 * submitted search and the page. Mount it under a
 * `key` of the program, so a new program starts from nothing.
 */
export const useFinderController = ({
    program,
    onSelect,
    client,
}: FinderControllerOptions): FinderContextValue => {
    const runtimeClient = useTrackedEntityFinderClient()
    const resourceClient = useMemo(
        () => resourceClientOf(client ?? runtimeClient),
        [client, runtimeClient]
    )
    const metadata = useQuery(
        programMetadataQueryOptions(resourceClient, program)
    )
    const systemInfo = useQuery(systemInfoQueryOptions(resourceClient))
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
        client: resourceClient,
        program,
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
            setSubmission((current) => ({
                search,
                id: (current?.id ?? 0) + 1,
            }))
            setPage(1)
        },
        []
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
            meta: { program, client: resourceClient, info: systemInfo.data },
        }),
        [
            status,
            model,
            submission,
            page,
            results,
            actions,
            program,
            resourceClient,
            systemInfo.data,
        ]
    )
}
