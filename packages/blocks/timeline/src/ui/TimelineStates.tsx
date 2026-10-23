import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { Alert, ErrorAlert } from '@/registry/dhis2/ui/alert'
import { Button } from '@/registry/dhis2/ui/button'
import { Skeleton } from '@/registry/dhis2/ui/skeleton'
import type { SourceState } from '../core/types'
import { useTimelineActions, useTimelineState } from './TimelineContext'

/** Placeholder rows while the first answers are on their way. */
export const TimelineLoading = () => {
    const loading = useTimelineState((state) => state.status === 'loading')
    if (!loading) {
        return null
    }
    return (
        <div role="status" className="flex flex-col gap-3">
            <span className="sr-only">{i18n.t('Loading')}</span>
            {[0, 1, 2].map((row) => (
                <Skeleton key={row} aria-hidden="true" className="h-10" />
            ))}
        </div>
    )
}

/** Shown when every source failed, with one Retry for them all. */
export const TimelineError = ({ children }: { children?: React.ReactNode }) => {
    const allFailed = useTimelineState((state) => state.allFailed)
    const sources = useTimelineState((state) => state.sources)
    const { retry } = useTimelineActions()
    if (!allFailed) {
        return null
    }
    return (
        <ErrorAlert title={children ?? i18n.t("Couldn't load the history")}>
            <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                    for (const source of sources) {
                        if (source.status === 'error') {
                            retry(source.key)
                        }
                    }
                }}
            >
                {i18n.t('Retry')}
            </Button>
        </ErrorAlert>
    )
}

const SourceNotice = ({
    source,
    allFailed,
}: {
    source: SourceState
    allFailed: boolean
}) => {
    const { retry } = useTimelineActions()
    const notices: React.ReactNode[] = []
    // When every source failed, TimelineError says so once, with its Retry.
    if (source.status === 'error' && !allFailed) {
        notices.push(
            <Alert key="error" variant="warning" role="status">
                <span>
                    {i18n.t("{{label}} couldn't load.", {
                        label: source.label,
                    })}
                </span>
                <div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => retry(source.key)}
                    >
                        {i18n.t('Retry')}
                    </Button>
                </div>
            </Alert>
        )
    }
    if (source.status === 'unsupported') {
        notices.push(
            <Alert key="unsupported" role="status">
                {i18n.t("{{label}} isn't available on this DHIS2 version.", {
                    label: source.label,
                })}
            </Alert>
        )
    }
    if (source.partial) {
        notices.push(
            <Alert key="partial" variant="warning" role="status">
                {i18n.t('Some {{label}} may be hidden by your access.', {
                    label: source.label,
                })}
            </Alert>
        )
    }
    if (source.notice !== undefined) {
        notices.push(
            <Alert key="notice" role="status">
                {source.notice}
            </Alert>
        )
    }
    return notices.map((notice, index) => <li key={index}>{notice}</li>)
}

/**
 * One notice per source that failed, is unsupported, is partial or says
 * something. Failures are left to TimelineError when every source failed.
 */
export const TimelineSourceNotices = () => {
    const sources = useTimelineState((state) => state.sources)
    const allFailed = useTimelineState((state) => state.allFailed)
    const noticed = sources.filter(
        (source) =>
            (source.status === 'error' && !allFailed) ||
            source.status === 'unsupported' ||
            source.partial ||
            source.notice !== undefined
    )
    if (noticed.length === 0) {
        return null
    }
    return (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {noticed.map((source) => (
                <SourceNotice
                    key={source.key}
                    source={source}
                    allFailed={allFailed}
                />
            ))}
        </ul>
    )
}
