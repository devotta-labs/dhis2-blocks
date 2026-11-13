import type { ReactNode } from 'react'

/** A list of rows sized by the density tokens, for a navigator or a flush section. */
export const Rows = ({
    items,
    current,
    onPick,
}: {
    items: ReadonlyArray<{ id: string; name: ReactNode; meta?: ReactNode }>
    current?: string
    onPick?: (id: string) => void
}) => (
    <ul className="m-0 list-none p-0">
        {items.map(({ id, name, meta }) => (
            <li key={id}>
                <button
                    type="button"
                    aria-current={id === current || undefined}
                    className="flex min-h-(--dhis2-row-h) w-full cursor-pointer items-center gap-(--dhis2-gap) border-0 bg-transparent px-(--dhis2-pane-pad) text-start font-[inherit] text-(length:--dhis2-text) text-dhis2-foreground hover:bg-dhis2-accent focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring aria-[current]:bg-dhis2-selected aria-[current]:text-dhis2-selected-foreground"
                    onClick={() => onPick?.(id)}
                >
                    <span className="min-w-0 flex-1 truncate">{name}</span>
                    {meta !== undefined && (
                        <span className="shrink-0 text-(length:--dhis2-text-sm) text-dhis2-muted-foreground">
                            {meta}
                        </span>
                    )}
                </button>
            </li>
        ))}
    </ul>
)
