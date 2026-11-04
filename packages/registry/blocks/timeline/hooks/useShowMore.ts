import { useCallback, useMemo, useState } from 'react'
import { revealPast } from '../core/reveal'
import { localDay } from '../core/today'
import type { TimelineEntry } from '../core/types'

/**
 * Shows every future and overdue entry and the newest `step` past ones;
 * `showMore` reveals `step` more. The entries are all in memory: this only
 * keeps the page short. The count outlives a change of `entries`: give the
 * component a `key` per record (`key={trackedEntity}`) so the next one starts
 * short.
 */
export const useShowMore = <TData>(
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
