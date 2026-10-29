import i18n from '@dhis2/d2-i18n'
import { useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { useDataEntry } from '../provider/hooks'

const MoreButton = ({ end }: { end: string }) => {
    const loading = useDataEntry((view) => view.loadingMore)
    const loadMore = useDataEntry((view) => view.loadMore)
    const button = useRef<HTMLButtonElement>(null)
    // Gone while focused (nothing more to load), it leaves focus past the grid rather than on nothing.
    useLayoutEffect(() => {
        const node = button.current
        return () => {
            if (node !== null && node === document.activeElement) {
                document.getElementById(end)?.focus()
            }
        }
    }, [end])
    return (
        <Button
            ref={button}
            type="button"
            variant="secondary"
            size="sm"
            // Busy, it keeps focus and says so, and a press does nothing.
            aria-busy={loading}
            disabled={loading}
            focusableWhenDisabled
            className="self-start aria-disabled:cursor-not-allowed aria-disabled:text-dhis2-grey-600"
            onClick={() => void loadMore()}
        >
            {i18n.t('Show more events')}
        </Button>
    )
}

/** "Show more events" while the source may have more; `end` takes the focus it held once there is nothing more. */
export const ShowMoreEvents = ({ end }: { end: string }) =>
    useDataEntry((view) => view.hasMore) ? <MoreButton end={end} /> : null
