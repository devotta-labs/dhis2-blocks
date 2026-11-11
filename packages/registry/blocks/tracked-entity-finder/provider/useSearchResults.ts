import i18n from '@dhis2/d2-i18n'
import { hashKey, skipToken, useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import type { FinderResourceClient } from '../api/client'
import { finderKeys, searchQueryOptions } from '../api/queries'
import type { FinderPerson } from '../api/search'
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
    const options =
        model && submission
            ? searchQueryOptions(client, model, submission.search, page)
            : ({
                  queryKey: finderKeys.search(program, undefined, page),
                  queryFn: skipToken,
              } as const)
    const query = useQuery({
        ...options,
        enabled:
            finderStatus === 'ready' &&
            model !== undefined &&
            submission !== undefined,
        // Only a page change of the same search keeps the old page on screen.
        placeholderData: (previous, previousQuery) =>
            previousQuery?.queryKey[2] === program &&
            hashKey(previousQuery.queryKey[3]) === hashKey(options.queryKey[3])
                ? previous
                : undefined,
    })

    const outcome = submission ? query.data : undefined
    const completed = useRef(0)
    useEffect(() => {
        if (
            !submissionId ||
            query.isPending ||
            query.isFetching ||
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
            if (outcome.total === undefined && outcome.hasNext) {
                announce(i18n.t('At least {{count}} people found', { count }))
                return
            }
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
        query.isFetching,
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
