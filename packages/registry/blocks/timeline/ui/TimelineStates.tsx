import i18n from '@dhis2/d2-i18n'
import React, { type ComponentPropsWithoutRef } from 'react'
import { Alert, ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Skeleton } from '@/components/dhis2/ui/skeleton'
import type { TimelineNotice } from '../core/types'
import { useOptionalTimeline, useTimeline } from './TimelineContext'

/** Placeholder rows while the timeline's status is `'pending'`. */
export const TimelineLoading = ({
    className,
    ...props
}: ComponentPropsWithoutRef<'div'>) => {
    const { state } = useTimeline()
    if (state.status !== 'pending') {
        return null
    }
    return (
        <div
            {...props}
            role="status"
            data-slot="timeline-loading"
            className={cn('flex flex-col gap-3', className)}
        >
            <span className="sr-only">{i18n.t('Loading')}</span>
            {[0, 1, 2].map((row) => (
                <Skeleton key={row} aria-hidden="true" className="h-10" />
            ))}
        </div>
    )
}

/** Shown when the status is `'success'` and there is nothing to list. */
export const TimelineEmpty = ({
    className,
    children,
    ...props
}: ComponentPropsWithoutRef<'p'>) => {
    const { state } = useTimeline()
    if (state.status !== 'success' || state.entries.length > 0) {
        return null
    }
    return (
        <p
            {...props}
            data-slot="timeline-empty"
            className={cn('text-sm text-dhis2-grey-700', className)}
        >
            {children ?? i18n.t('No history yet')}
        </p>
    )
}

/** Shown when the status is `'error'`, with a Retry when `onRetry` is given. */
export const TimelineError = ({
    onRetry,
    children,
    ...props
}: Omit<ComponentPropsWithoutRef<'div'>, 'title'> & {
    onRetry?: () => void
}) => {
    const { state } = useTimeline()
    if (state.status !== 'error') {
        return null
    }
    return (
        <ErrorAlert
            {...props}
            data-slot="timeline-error"
            title={children ?? i18n.t("Couldn't load the history")}
        >
            {onRetry === undefined ? null : (
                <div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={onRetry}
                    >
                        {i18n.t('Retry')}
                    </Button>
                </div>
            )}
        </ErrorAlert>
    )
}

const VARIANT = {
    info: 'default',
    warning: 'warning',
    error: 'warning',
} as const satisfies Record<TimelineNotice['tone'], string>

/**
 * One alert per notice: a part that failed (with its Retry), data capped, a
 * feature the server lacks. Inside a `Timeline` whose status is `'error'`,
 * failures are left to `TimelineError`, which says so once. Works outside a
 * `Timeline` too.
 */
export const TimelineNotices = ({
    notices: given,
    className,
    ...props
}: ComponentPropsWithoutRef<'ul'> & {
    notices: ReadonlyArray<TimelineNotice>
}) => {
    const timeline = useOptionalTimeline()
    const notices =
        timeline?.state.status === 'error'
            ? given.filter((notice) => notice.tone !== 'error')
            : given
    if (notices.length === 0) {
        return null
    }
    return (
        <ul
            {...props}
            data-slot="timeline-notices"
            className={cn('m-0 flex list-none flex-col gap-2 p-0', className)}
        >
            {notices.map((notice) => (
                <li key={notice.id}>
                    <Alert
                        variant={VARIANT[notice.tone]}
                        role="status"
                        data-slot="timeline-notice"
                        data-tone={notice.tone}
                    >
                        <span>{notice.message}</span>
                        {notice.retry === undefined ? null : (
                            <div>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={notice.retry}
                                >
                                    {i18n.t('Retry')}
                                </Button>
                            </div>
                        )}
                    </Alert>
                </li>
            ))}
        </ul>
    )
}
