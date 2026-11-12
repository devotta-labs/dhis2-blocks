import i18n from '@dhis2/d2-i18n'
import { useEffect, useRef } from 'react'
import { announce } from '@/components/dhis2/ui/announcer'
import { useSearchPages } from '../api/queries'
import type { SearchOutcome } from '../api/search'
import { useFinderContext } from './context'
import { useFinderModel } from './useFinderModel'

const countText = (found: Extract<SearchOutcome, { kind: 'results' }>) => {
    const count = found.total ?? found.people.length
    // Without a total, a full first page only proves there are at least these.
    if (found.total === undefined && found.hasNext) {
        return i18n.t('At least {{count}} people found', { count })
    }
    // Both keys are extractable; count also reaches i18next's plural rules.
    return count === 1
        ? i18n.t('{{count}} person found', { count })
        : i18n.t('{{count}} people found', { count })
}

/**
 * Internal: tells screen readers how many people a search found, once for
 * every Search pressed, also when the answer came from the cache. Paging and
 * background refreshes say nothing. The provider renders it once, however
 * many results parts read the same search.
 */
export function ResultCountAnnouncer() {
    const { submission } = useFinderContext()
    const { model } = useFinderModel()
    const query = useSearchPages(model, submission?.search)
    const first = query.data?.pages[0]
    const settled = !query.isPending && !query.isFetching
    const submissionId = submission?.id
    const announced = useRef<number>()

    useEffect(() => {
        if (
            submissionId === undefined ||
            !settled ||
            announced.current === submissionId
        ) {
            return
        }
        announced.current = submissionId
        if (first?.kind === 'results' && first.people.length > 0) {
            announce(countText(first))
        }
    }, [submissionId, settled, first])

    return null
}
