import { Card } from '@/components/dhis2/ui/card'
import { Skeleton } from '@/components/dhis2/ui/skeleton'

const LoadingCard = () => (
    <Card className="min-w-0 gap-2 border border-dhis2-border-strong p-4 shadow-none">
        <Skeleton className="my-0.5 h-4 w-24" />
        <Skeleton className="h-[30px] w-24" />
        <Skeleton className="my-0.5 h-4 w-40 max-w-full" />
        {}
        <div className="@container mt-auto w-full">
            <Skeleton className="hidden h-10 w-full @[13rem]:block" />
        </div>
        {}
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
