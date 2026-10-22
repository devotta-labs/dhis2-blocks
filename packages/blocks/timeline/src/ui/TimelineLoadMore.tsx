import i18n from '@dhis2/d2-i18n'
import React, { useEffect, useRef } from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import {
    useTimelineActions,
    useTimelineId,
    useTimelineState,
} from './TimelineContext'

interface Request {
    /** How many entries there were when the button was pressed. */
    count: number
    sawLoading: boolean
}

/**
 * Asks for older entries, then moves focus to the first one that arrives. When
 * nothing arrives, focus returns to the button, or to the last entry if the
 * button has gone.
 */
export const TimelineLoadMore = () => {
    const id = useTimelineId()
    const { loadMore } = useTimelineActions()
    const hasMore = useTimelineState((state) => state.hasMore)
    const loadingMore = useTimelineState((state) => state.loadingMore)
    const count = useTimelineState((state) => state.entries.length)
    const request = useRef<Request>()
    const button = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        const pending = request.current
        if (pending === undefined) {
            return
        }
        const entryAt = (index: number) =>
            document.querySelector<HTMLElement>(
                `[data-timeline-id="${id}"][data-timeline-entry-index="${index}"]`
            )
        if (count > pending.count) {
            request.current = undefined
            entryAt(pending.count)?.focus()
        } else if (loadingMore) {
            pending.sawLoading = true
        } else if (pending.sawLoading) {
            request.current = undefined
            if (button.current !== null) {
                button.current.focus()
            } else {
                entryAt(count - 1)?.focus()
            }
        }
    }, [count, loadingMore, hasMore, id])

    if (!hasMore) {
        return null
    }
    return (
        <Button
            ref={button}
            type="button"
            variant="outline"
            disabled={loadingMore}
            aria-busy={loadingMore}
            onClick={() => {
                const pending: Request = { count, sawLoading: false }
                request.current = pending
                loadMore()
                // A press that starts no load leaves nothing to wait for; the
                // render that shows the load has run by now.
                setTimeout(() => {
                    if (request.current === pending && !pending.sawLoading) {
                        request.current = undefined
                    }
                }, 0)
            }}
        >
            {loadingMore ? i18n.t('Loading more') : i18n.t('Load more')}
        </Button>
    )
}
