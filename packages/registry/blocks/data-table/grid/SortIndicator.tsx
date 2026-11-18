/** The sort indicator @dhis2/ui DataTableColumnHeader draws. */
export const SortIndicator = ({
    sorted,
}: {
    sorted: false | 'asc' | 'desc'
}) => (
    <span
        aria-hidden="true"
        data-slot="sort-indicator"
        data-direction={sorted || 'none'}
        className="ms-0.5 flex size-6 shrink-0 items-center justify-center rounded-dhis2-md group-hover/sort:bg-dhis2-accent-strong group-focus-visible/sort:bg-dhis2-accent-strong"
    >
        <svg viewBox="0 0 16 16" className="size-4">
            {/* DHIS2 names these "top" and "bottom" by stacking order, not
                by direction: ascending highlights the down-pointing one. */}
            <polygon
                points="4 9 12 9 8 14"
                className={
                    sorted === 'asc'
                        ? 'fill-dhis2-primary'
                        : 'fill-dhis2-subtle-foreground'
                }
            />
            <polygon
                points="4 7 12 7 8 2"
                className={
                    sorted === 'desc'
                        ? 'fill-dhis2-primary'
                        : 'fill-dhis2-subtle-foreground'
                }
            />
        </svg>
    </span>
)
