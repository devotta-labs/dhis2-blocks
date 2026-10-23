import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
    shouldRetryFinderRequest,
    type FinderResourceClient,
} from '../api/client'
import { finderKeys } from '../api/queries'
import { runSearch, type FinderPerson } from '../api/search'
import { serializeFilter } from '../rules/searchParams'
import type { ProgramModel } from '../rules/types'
import type {
    FinderResultsStatus,
    FinderResultsView,
    FinderStatus,
    FinderSubmission,
} from './context'

export interface SearchResultsOptions {
    client: FinderResourceClient
    program: string
    model?: ProgramModel
    status: FinderStatus
    submission?: FinderSubmission
    page: number
}

const NO_PEOPLE: readonly FinderPerson[] = Object.freeze([])

/**
 * Runs the submitted search for the current page. The provider calls it
 * once; parts read the answer from context.
 */
export const useSearchResults = ({
    client,
    program,
    model,
    status: finderStatus,
    submission,
    page,
}: SearchResultsOptions): FinderResultsView => {
    const submissionId = submission?.id ?? 0
    const query = useQuery({
        // The filters are in the key too: a remounted provider restarts its ids.
        queryKey: finderKeys.search(
            program,
            {
                submission: submissionId,
                filter: submission?.search.filters.map(serializeFilter) ?? [],
            },
            page
        ),
        queryFn: ({ signal }) => {
            if (!model || !submission) {
                throw new Error('A finder search ran without a submission')
            }
            return runSearch(client, model, submission.search, page, signal)
        },
        enabled:
            finderStatus === 'ready' &&
            model !== undefined &&
            submission !== undefined,
        // A sealed submission never changes; Search again makes a new one.
        staleTime: Number.POSITIVE_INFINITY,
        retry: shouldRetryFinderRequest,
        // Only a page change of the same search keeps the old page on screen.
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[3]?.submission === submissionId
                ? previous
                : undefined,
    })

    const outcome = submission ? query.data : undefined
    const status: FinderResultsStatus = (() => {
        if (finderStatus === 'error') {
            return 'error'
        }
        if (!submission) {
            return 'idle'
        }
        if (query.isError) {
            return 'error'
        }
        if (!outcome) {
            return 'searching'
        }
        if (outcome.kind === 'too-many') {
            return 'too-many'
        }
        return outcome.people.length ? 'results' : 'empty'
    })()
    const found = status === 'results' && outcome?.kind === 'results'
    const people = found ? outcome.people : NO_PEOPLE
    const hasNext = found ? outcome.hasNext : false
    const refreshing = status !== 'searching' && query.isFetching

    return useMemo(
        () => ({ status, people, hasNext, refreshing }),
        [status, people, hasNext, refreshing]
    )
}
