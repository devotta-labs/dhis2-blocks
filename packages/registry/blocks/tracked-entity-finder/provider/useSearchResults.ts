import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
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

/** Counts finder mounts, so each mount keys its searches apart. */
let mounts = 0

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
    // Submission ids restart with each mount. A new mount must ask the server
    // again: the same search may find someone registered in the meantime.
    const [instance] = useState(() => ++mounts)
    const submissionId = submission?.id ?? 0
    const query = useQuery({
        queryKey: finderKeys.search(
            program,
            {
                instance,
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
            previousQuery?.queryKey[3]?.instance === instance &&
            previousQuery.queryKey[3].submission === submissionId
                ? previous
                : undefined,
    })

    const outcome = submission ? query.data : undefined
    const completed = useRef(0)
    useEffect(() => {
        if (
            !submissionId ||
            query.isPending ||
            query.isPlaceholderData ||
            completed.current === submissionId
        ) {
            return
        }
        completed.current = submissionId
        if (
            page === 1 &&
            query.isSuccess &&
            outcome?.kind === 'results' &&
            outcome.people.length > 0
        ) {
            const count = outcome.total ?? outcome.people.length
            // Both keys are extractable; count also reaches i18next's plural rules.
            announce(
                count === 1
                    ? i18n.t('{{count}} person found', { count })
                    : i18n.t('{{count}} people found', { count })
            )
        }
    }, [
        submissionId,
        page,
        outcome,
        query.isPending,
        query.isPlaceholderData,
        query.isSuccess,
    ])

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
