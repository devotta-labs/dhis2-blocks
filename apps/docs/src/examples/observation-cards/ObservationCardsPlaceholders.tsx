import { Card } from '@/components/dhis2/ui/card'
import { Skeleton } from '@/components/dhis2/ui/skeleton'

/**
 * Loading placeholder for the Observation Cards example.
 *
 * It belongs to the docs, not the block: it covers the time before the
 * example can mount the block at all — its code loading and the adapter
 * starting the DHIS2 session. It copies the shape of the block's own loading
 * card before the program's metadata arrives (a heading, a value, a change
 * line, a sparkline and the recorded date in the footer band) in the
 * example's two-column grid, so the preview does not change layout when the
 * block takes over. If the card's loading state changes, update this to match.
 */
const LoadingCard = () => (
    <Card className="min-w-0 gap-2 border border-dhis2-border-strong p-4 shadow-none">
        <Skeleton className="my-0.5 h-4 w-24" />
        <Skeleton className="h-[30px] w-24" />
        <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
        {/* Dropped below 13rem, as the sparkline is. */}
        <div className="@container mt-auto w-full">
            <Skeleton className="hidden h-10 w-full @[13rem]:block" />
        </div>
        {/* The block's footer band. */}
        <div className="-mx-4 -mb-4 flex rounded-b-dhis2-md border-t border-dhis2-border bg-dhis2-background-subtle px-4 py-2">
            <Skeleton className="my-0.5 h-3 w-20 max-w-full" />
        </div>
    </Card>
)

export const PersonVitalsPlaceholder = () => (
    <div className="grid max-w-2xl gap-4 sm:grid-cols-2" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the observation cards…
        </span>
        <LoadingCard />
        <LoadingCard />
        <LoadingCard />
    </div>
)
