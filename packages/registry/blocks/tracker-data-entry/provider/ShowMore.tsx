import i18n from '@dhis2/d2-i18n'
import { useId, useLayoutEffect, useRef } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import { useTrackerDataEntry } from './hooks'

interface FooterProps {
    /** Where focus goes when the button goes while it holds focus. */
    skipTargetId: string
}

const MoreButton = ({
    skipTargetId,
    label,
}: FooterProps & { label: string }) => {
    const loading = useTrackerDataEntry((view) => view.loadingMore)
    const loadMore = useTrackerDataEntry((view) => view.loadMore)
    const error = useTrackerDataEntry((view) => view.loadMoreError)
    const errorId = useId()
    const button = useRef<HTMLButtonElement>(null)
    // Gone while focused (nothing more to load), it leaves focus past the grid rather than on nothing.
    useLayoutEffect(() => {
        const node = button.current
        return () => {
            if (node !== null && node === document.activeElement) {
                document.getElementById(skipTargetId)?.focus()
            }
        }
    }, [skipTargetId])
    return (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Button
                ref={button}
                type="button"
                variant="secondary"
                size="sm"
                // Busy, it keeps focus and says so, and a press does nothing.
                aria-busy={loading}
                aria-describedby={error === undefined ? undefined : errorId}
                disabled={loading}
                focusableWhenDisabled
                className="aria-disabled:cursor-not-allowed aria-disabled:text-dhis2-grey-600"
                onClick={() => void loadMore()}
            >
                {label}
            </Button>
            {/* Said once when the page fails; shown until the next try. */}
            {error === undefined ? null : (
                <p id={errorId} className="text-sm text-dhis2-red-700">
                    {error}
                </p>
            )}
        </div>
    )
}

/** The button while the source may have more, with why the last page could not load beside it. */
const ShowMore = ({ skipTargetId, label }: FooterProps & { label: string }) => {
    const hasMore = useTrackerDataEntry((view) => view.hasMore)
    return hasMore ? (
        <MoreButton skipTargetId={skipTargetId} label={label} />
    ) : null
}

/** "Show more events" after the grid, for its `GridFooter`. */
export const ShowMoreEvents = ({ skipTargetId }: FooterProps) => (
    <ShowMore skipTargetId={skipTargetId} label={i18n.t('Show more events')} />
)

/** "Show more people" after a register's grid, for its `GridFooter`. */
export const ShowMorePeople = ({ skipTargetId }: FooterProps) => (
    <ShowMore skipTargetId={skipTargetId} label={i18n.t('Show more people')} />
)
