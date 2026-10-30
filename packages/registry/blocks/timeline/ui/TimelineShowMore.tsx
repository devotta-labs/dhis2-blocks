import i18n from '@dhis2/d2-i18n'
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { revealPast } from '../core/reveal'
import { localDay } from '../core/today'
import type { TimelineEntry } from '../core/types'
import { useTimeline } from './TimelineContext'

/**
 * Shows every future and overdue entry and the newest `step` past ones;
 * `showMore` reveals `step` more. The entries are all in memory: this only
 * keeps the page short. The count outlives a change of `entries`: give the
 * component a `key` per record (`key={trackedEntity}`) so the next one starts
 * short.
 */
export const useShowMore = <TData,>(
    entries: ReadonlyArray<TimelineEntry<TData>>,
    { step = 50, now }: { step?: number; now?: Date } = {}
) => {
    const [count, setCount] = useState(step)
    const today = localDay(now ?? new Date())
    const revealed = useMemo(
        () => revealPast(entries, { count, today }),
        [entries, count, today]
    )
    const showMore = useCallback(
        () => setCount((shown) => shown + step),
        [step]
    )
    return {
        entries: revealed.entries,
        hasMore: revealed.hidden > 0,
        showMore,
    }
}

interface Request {
    /** The entries on show when the button was pressed. */
    shown: ReadonlySet<string>
    sawLoading: boolean
}

/**
 * Asks for more entries, then moves focus to the first one that arrives, in
 * reading order, and announces how many arrived. When nothing arrives, focus stays on the button, or goes to
 * the last entry if the button has gone. `onShowMore` can reveal entries
 * already in memory (`useShowMore`) or fetch the next server page; a fetch
 * must turn `loading` on in the same update, or the press counts as one that
 * added nothing.
 */
export const TimelineShowMore = ({
    hasMore,
    onShowMore,
    loading = false,
    className,
    children,
    ...props
}: Omit<ComponentPropsWithoutRef<typeof Button>, 'onClick'> & {
    hasMore: boolean
    onShowMore: () => void
    loading?: boolean
}) => {
    const { state, meta } = useTimeline()
    const { entries, groups } = state
    const { id } = meta
    const request = useRef<Request>()
    const button = useRef<HTMLButtonElement>(null)
    const [announced, setAnnounced] = useState('')

    useEffect(() => {
        const pending = request.current
        if (pending === undefined) {
            return
        }
        const ordered = groups.flatMap((group) => group.entries)
        const added = ordered.filter((entry) => !pending.shown.has(entry.id))
        const [fresh] = added
        const itemOf = (entryId: string) =>
            document.querySelector<HTMLElement>(
                `[data-timeline-id="${CSS.escape(id)}"][data-timeline-entry="${CSS.escape(entryId)}"]`
            )
        if (fresh !== undefined) {
            request.current = undefined
            itemOf(fresh.id)?.focus()
            setAnnounced(
                added.length === 1
                    ? i18n.t('1 older entry shown')
                    : i18n.t('{{count}} older entries shown', {
                          count: added.length,
                      })
            )
        } else if (loading) {
            pending.sawLoading = true
        } else if (pending.sawLoading) {
            request.current = undefined
            const last = ordered.at(-1)
            if (button.current !== null) {
                button.current.focus()
            } else if (last !== undefined) {
                itemOf(last.id)?.focus()
            }
        }
    }, [entries, groups, loading, hasMore, id])

    // Stays mounted after the last press, so its announcement is still heard.
    const status = (
        <span role="status" className="sr-only">
            {announced}
        </span>
    )
    if (!hasMore) {
        return status
    }
    return (
        <>
            {status}
            <Button
                variant="secondary"
                size="sm"
                {...props}
                // Sits under the entries, at their indent, not across the page.
                className={cn('ms-6 self-start text-sm!', className)}
                ref={button}
                type="button"
                data-slot="timeline-show-more"
                disabled={loading}
                // Keeps focus on the button while it loads, not on <body>.
                focusableWhenDisabled
                aria-busy={loading}
                onClick={() => {
                    const pending: Request = {
                        shown: new Set(entries.map((entry) => entry.id)),
                        sawLoading: false,
                    }
                    request.current = pending
                    onShowMore()
                    // A press that starts no load and adds nothing leaves nothing
                    // to wait for; the render that shows either has run by now.
                    setTimeout(() => {
                        if (
                            request.current === pending &&
                            !pending.sawLoading
                        ) {
                            request.current = undefined
                        }
                    }, 0)
                }}
            >
                {children ??
                    (loading
                        ? i18n.t('Loading more')
                        : i18n.t('Show older entries'))}
            </Button>
        </>
    )
}

/**
 * "Start of the record", under the oldest entry once `hasMore` is false. It
 * is said only when `complete`: when a request failed or a cap left entries
 * out, it shows nothing and the notices say what is missing. Oldest-first
 * timelines start at the top, so it shows nothing there either.
 */
export const TimelineEnd = ({
    hasMore,
    complete,
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'p'> & {
    hasMore: boolean
    /** Every entry of the record was asked for and arrived: no cap, no failure. */
    complete: boolean
}) => {
    const { state, meta } = useTimeline()
    if (
        hasMore ||
        !complete ||
        meta.order !== 'desc' ||
        state.status !== 'success' ||
        state.entries.length === 0
    ) {
        return null
    }
    return (
        <p
            {...props}
            data-slot="timeline-end"
            className={cn('m-0 ms-6 text-sm text-dhis2-grey-700', className)}
        >
            {children ?? i18n.t('Start of the record')}
        </p>
    )
}
