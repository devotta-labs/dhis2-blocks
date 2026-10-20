import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/registry/dhis2/ui/card'
import { cn } from '@/registry/dhis2/ui/cn'
import { Skeleton } from '@/registry/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React, { useId } from 'react'

export interface ObservationCardFrameProps {
    /** Names the card. While pending without one, a skeleton stands in for it. */
    label?: React.ReactNode
    /** Shown beside the label, such as a legend badge. */
    badge?: React.ReactNode
    /**
     * What the body shows: the children, a loading skeleton, a failure notice,
     * or the "never recorded" notice.
     */
    state?: 'content' | 'pending' | 'error' | 'empty'
    /** A note under the body. */
    footer?: React.ReactNode
    /**
     * `stale` marks a reading that is out of date: the body is greyed and the
     * card keeps a border. The card's own footer carries the warning note.
     */
    tone?: 'default' | 'stale'
    className?: string
    children?: React.ReactNode
}

/** The shell shared by the observation cards: label row, body and footer note. */
export function ObservationCardFrame({
    label,
    badge,
    state = 'content',
    footer,
    tone = 'default',
    className,
    children,
}: ObservationCardFrameProps) {
    const titleId = useId()
    const hasLabel = label !== undefined && label !== null && label !== ''
    const pending = state === 'pending'

    return (
        <Card
            role="group"
            aria-labelledby={hasLabel ? titleId : undefined}
            aria-busy={pending || undefined}
            data-tone={tone}
            className={cn(
                'min-w-0',
                tone === 'stale' && 'border border-dhis2-grey-400',
                className
            )}
        >
            <CardHeader className="flex-row items-center justify-between gap-2">
                {hasLabel ? (
                    <CardTitle
                        id={titleId}
                        role="heading"
                        aria-level={3}
                        className="min-w-0 text-sm text-dhis2-grey-700"
                    >
                        {label}
                    </CardTitle>
                ) : pending ? (
                    <Skeleton className="h-4 w-24" />
                ) : null}
                {badge}
            </CardHeader>
            <CardContent
                className={cn(
                    'flex min-w-0 flex-col gap-2',
                    tone === 'stale' && 'text-dhis2-grey-600'
                )}
            >
                {pending ? (
                    <>
                        <span className="sr-only">{i18n.t('Loading')}</span>
                        <Skeleton className="h-8 w-28" />
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="h-10 w-full" />
                    </>
                ) : state === 'error' ? (
                    <p className="text-sm text-dhis2-destructive">
                        {i18n.t("Couldn't load this value")}
                    </p>
                ) : state === 'empty' ? (
                    <p className="text-sm text-dhis2-grey-700">
                        {i18n.t('Never recorded')}
                    </p>
                ) : (
                    children
                )}
            </CardContent>
            {footer ? (
                <CardFooter className="flex-col items-start gap-1 text-xs text-dhis2-grey-700">
                    {footer}
                </CardFooter>
            ) : null}
        </Card>
    )
}
