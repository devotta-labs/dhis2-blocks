import { Skeleton } from '@/components/dhis2/ui/skeleton'

/**
 * Loading placeholder for the Clinic Selector sidebar example.
 *
 * It belongs to the docs, not the block: it covers the time before the
 * example can mount the block at all — its code loading and the adapter
 * starting the DHIS2 session. It copies the example's own frame (a sidebar
 * with the selector's loading row, and a page heading) so the preview does
 * not change layout when the block takes over.
 */
export const ClinicSelectorSidebarPlaceholder = () => (
    <div
        aria-busy="true"
        className="flex min-h-80 flex-col overflow-hidden rounded-md border border-border bg-background md:flex-row"
    >
        <span className="sr-only" role="status">
            Loading the clinic selector…
        </span>
        <div className="bg-dhis2-sidebar px-3 py-4 md:w-60">
            <div className="flex min-h-9 items-center gap-2 p-1">
                <Skeleton className="size-7 shrink-0 bg-dhis2-sidebar-accent" />
                <Skeleton className="h-4 flex-1 bg-dhis2-sidebar-accent" />
            </div>
        </div>
        <div className="flex-1 p-6">
            <Skeleton className="h-7 w-48 max-w-full" />
        </div>
    </div>
)
