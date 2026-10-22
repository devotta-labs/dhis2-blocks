import i18n from '@dhis2/d2-i18n'
import React, { useEffect, useRef } from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import {
    useTimelineActions,
    useTimelineId,
    useTimelineState,
} from './TimelineContext'

/** Asks for older entries, then moves focus to the first one that arrives. */
export const TimelineLoadMore = () => {
    const id = useTimelineId()
    const { loadMore } = useTimelineActions()
    const hasMore = useTimelineState((state) => state.hasMore)
    const loadingMore = useTimelineState((state) => state.loadingMore)
    const count = useTimelineState((state) => state.entries.length)
    /** How many entries there were when the request was made. */
    const requestedAt = useRef<number>()

    useEffect(() => {
        const before = requestedAt.current
        if (before === undefined) {
            return
        }
        if (count > before) {
            requestedAt.current = undefined
            document
                .querySelector<HTMLElement>(
                    `[data-timeline-id="${id}"][data-timeline-entry-index="${before}"]`
                )
                ?.focus()
        } else if (!loadingMore) {
            requestedAt.current = undefined
        }
    }, [count, loadingMore, id])

    if (!hasMore) {
        return null
    }
    return (
        <Button
            type="button"
            variant="outline"
            disabled={loadingMore}
            aria-busy={loadingMore}
            onClick={() => {
                requestedAt.current = count
                loadMore()
            }}
        >
            {loadingMore ? i18n.t('Loading more') : i18n.t('Load more')}
        </Button>
    )
}
