import { cn } from '@/components/dhis2/ui/cn'
import { Fragment, type ComponentPropsWithoutRef, type ReactNode } from 'react'

interface Fact {
    label: ReactNode
    /** Left out, null or an empty string, the row shows `empty`. */
    value?: ReactNode
}

interface FactsProps extends ComponentPropsWithoutRef<'dl'> {
    items: readonly Fact[]
    /** What a row without a value shows. */
    empty?: ReactNode
}

/**
 * Read-only facts about an object, as label and value pairs on one line each.
 * Labels take up to half the width; long labels and values wrap.
 */
export const Facts = ({
    items,
    empty = '—',
    className,
    ...props
}: FactsProps) => (
    <dl
        {...props}
        className={cn(
            'm-0 grid grid-cols-[fit-content(50%)_minmax(0,1fr)] gap-x-(--dhis2-gap) gap-y-[calc(var(--dhis2-gap)/2)] text-(length:--dhis2-text)',
            className
        )}
    >
        {items.map(({ label, value }, index) => (
            // The list is read-only and its rows have no identity beyond their place.
            <Fragment key={index}>
                <dt className="wrap-anywhere text-dhis2-muted-foreground">
                    {label}
                </dt>
                <dd className="m-0 font-medium wrap-anywhere">
                    {value === undefined || value === null || value === '' ? (
                        <span className="font-normal text-dhis2-subtle-foreground">
                            {empty}
                        </span>
                    ) : (
                        value
                    )}
                </dd>
            </Fragment>
        ))}
    </dl>
)
