import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import { IconArrowDown16, IconArrowUp16 } from '@dhis2/ui-icons'
import React, { type ComponentPropsWithoutRef } from 'react'
import { useObservationCard } from '../card/context'
import { changeLine, showsTrend, type ChangeLine } from '../format/display'

export type ObservationChangeProps = Omit<
    ComponentPropsWithoutRef<'p'>,
    'children'
>

/** An arrow for sighted users and the word a screen reader says instead. */
function Direction({
    direction,
}: {
    direction: NonNullable<ChangeLine['direction']>
}) {
    const Arrow = direction === 'up' ? IconArrowUp16 : IconArrowDown16
    return (
        <>
            <span
                aria-hidden="true"
                data-slot="change-arrow"
                className="inline-flex align-[-2px] text-dhis2-grey-600 [&_svg]:size-3.5"
            >
                <Arrow />
            </span>
            <span className="sr-only">
                {direction === 'up' ? i18n.t('up') : i18n.t('down')}
            </span>{' '}
        </>
    )
}

/**
 * The change since the previous reading, and the legend move when there is
 * one. Nothing when there is no earlier reading.
 */
export function ObservationChange({
    className,
    ...props
}: ObservationChangeProps) {
    const { series, unit, display } = useObservationCard()
    // Option codes are categories: a difference between them means nothing.
    const change = showsTrend(series)
        ? changeLine(series, unit, display)
        : undefined
    if (change === undefined) {
        return null
    }
    return (
        <p
            {...props}
            data-slot="observation-change"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
            {change.direction ? (
                <Direction direction={change.direction} />
            ) : null}
            {change.text}
        </p>
    )
}
