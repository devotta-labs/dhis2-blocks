import i18n from '@dhis2/d2-i18n'
import React, {
    useEffect,
    useRef,
    useState,
    type ComponentPropsWithoutRef,
} from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { useTimeline } from '../hooks/useTimeline'

/**
 * Asks for more entries, then moves focus to the first one that arrives, in
 * reading order, and announces how many arrived. `onShowMore` can reveal
 * entries already in memory (`useShowMore`) or fetch the next server page.
 * Pass `loading` while it fetches: the button says so, and when the fetch
 * ends with nothing new, focus stays on the button, or goes to the last
 * entry if the button has gone.
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
    /** The entries on show when the button was pressed, until more arrive. */
    const shownAtPress = useRef<ReadonlySet<string>>()
    const wasLoading = useRef(loading)
    const button = useRef<HTMLButtonElement>(null)
    const [announced, setAnnounced] = useState('')

    useEffect(() => {
        const loadEnded = wasLoading.current && !loading
        wasLoading.current = loading
        const shown = shownAtPress.current
        if (shown === undefined) {
            return
        }
        const ordered = groups.flatMap((group) => group.entries)
        const added = ordered.filter((entry) => !shown.has(entry.id))
        const [fresh] = added
        const itemOf = (entryId: string) =>
            document.querySelector<HTMLElement>(
                `[data-timeline-id="${CSS.escape(id)}"][data-timeline-entry="${CSS.escape(entryId)}"]`
            )
        if (fresh !== undefined) {
            shownAtPress.current = undefined
            itemOf(fresh.id)?.focus()
            setAnnounced(
                added.length === 1
                    ? i18n.t('1 older entry shown')
                    : i18n.t('{{count}} older entries shown', {
                          count: added.length,
                      })
            )
        } else if (loadEnded) {
            shownAtPress.current = undefined
            const last = ordered.at(-1)
            if (button.current !== null) {
                button.current.focus()
            } else if (last !== undefined) {
                itemOf(last.id)?.focus()
            }
        }
    }, [groups, loading, id])

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
                    shownAtPress.current = new Set(
                        entries.map((entry) => entry.id)
                    )
                    onShowMore()
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
        state.entries.length === 0
    ) {
        return null
    }
    return (
        <p
            {...props}
            data-slot="timeline-end"
            className={cn(
                'm-0 ms-6 text-sm text-dhis2-muted-foreground',
                className
            )}
        >
            {children ?? i18n.t('Start of the record')}
        </p>
    )
}
