import { Card } from '@/components/dhis2/ui/card'
import { Skeleton } from '@/components/dhis2/ui/skeleton'

/**
 * Loading placeholder for the Observation Cards example.
 *
 * It belongs to the docs, not the block: it covers the time before the
 * example can mount the block at all — its code loading and the adapter
 * starting the DHIS2 session. It copies the shape of the block's own loading
 * card (a heading, a value, a trend line and the recorded date) in the
 * example's two-column grid, so the preview does not change layout when the
 * block takes over. If the card's loading state changes, update this to match.
 */
const LoadingCard = () => (
    <Card className="min-w-0 gap-2 border border-dhis2-grey-400 p-4 shadow-none">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-24" />
        <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
        <Skeleton className="my-0.5 h-3 w-36 max-w-full" />
    </Card>
)

export const PersonVitalsPlaceholder = () => (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the observation cards…
        </span>
        <LoadingCard />
        <LoadingCard />
    </div>
)
