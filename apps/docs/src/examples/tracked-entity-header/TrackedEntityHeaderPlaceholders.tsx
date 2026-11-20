import { Skeleton } from '@/components/dhis2/ui/skeleton'

const LoadingBanner = () => (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1.5 rounded-dhis2-md border border-dhis2-border-strong bg-dhis2-card px-3.5 py-2.5">
        <Skeleton className="h-7 w-48 max-w-full" />
        <div className="basis-full">
            <Skeleton className="h-5 w-72 max-w-full" />
        </div>
    </div>
)

export const PersonBannerPlaceholder = () => (
    <div className="grid gap-4" aria-busy="true">
        <span className="sr-only" role="status">
            Loading the person banner…
        </span>
        <LoadingBanner />
        <LoadingBanner />
    </div>
)
