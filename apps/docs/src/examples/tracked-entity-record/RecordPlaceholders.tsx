/**
 * Loading placeholder for the Tracked Entity Record examples.
 *
 * It belongs to the docs, not the block: it covers the time before an example
 * can mount at all (its code loading and the adapter starting the DHIS2
 * session). The examples' own loading state is a spinner, so this is one too.
 */
export const RecordPlaceholder = () => (
    <div
        className="flex min-h-[120px] items-center justify-center"
        aria-busy="true"
        aria-live="polite"
    >
        <span
            className="size-5 animate-spin rounded-full border-2 border-[#d5dde5] border-t-[#2c6693] motion-reduce:animate-none"
            aria-hidden="true"
        />
        <span className="sr-only">Loading preview…</span>
    </div>
)
