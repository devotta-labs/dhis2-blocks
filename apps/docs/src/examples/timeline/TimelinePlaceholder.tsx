/**
 * Loading placeholder for the live case history example: the shape of the
 * block's own TimelineLoading rows, so the preview keeps its layout while the
 * example's code loads and the adapter starts the DHIS2 session.
 */
export const TimelinePlaceholder = () => (
    <div role="status" className="flex flex-col gap-3 p-6">
        <span className="sr-only">Loading</span>
        {[0, 1, 2].map((row) => (
            <span
                key={row}
                aria-hidden="true"
                className="h-10 animate-pulse rounded-md bg-[#e8edf2] motion-reduce:animate-none"
            />
        ))}
    </div>
)
