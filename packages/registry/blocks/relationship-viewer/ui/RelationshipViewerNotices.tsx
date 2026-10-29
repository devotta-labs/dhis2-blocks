import { Alert, AlertTitle, ErrorAlert } from '@/components/dhis2/ui/alert'
import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import {
    useRelationshipViewerActions,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'

export function RelationshipViewerNotices({
    className,
}: {
    className?: string
}) {
    const { status, error, graph } = useRelationshipViewerState()
    const { retry } = useRelationshipViewerActions()
    const { cap } = useRelationshipViewerMeta()
    const failed = [...(graph?.nodes.values() ?? [])].filter(
        (node) => node.state.status === 'failed'
    ).length
    const message =
        error instanceof Error && error.message
            ? error.message
            : i18n.t('The relationship graph could not be loaded.')
    const retryButton = (
        <Button variant="secondary" size="sm" onClick={() => retry()}>
            {i18n.t('Retry')}
        </Button>
    )

    if (status !== 'error' && !graph?.capped && failed === 0) return null
    return (
        <div className={cn('flex flex-col gap-2', className)}>
            {status === 'error' && (
                <ErrorAlert title={message}>{retryButton}</ErrorAlert>
            )}
            {graph?.capped && (
                <Alert variant="warning">
                    <AlertTitle>
                        {i18n.t(
                            'Showing the first {{cap}} records. Some links are not loaded.',
                            { cap }
                        )}
                    </AlertTitle>
                </Alert>
            )}
            {failed > 0 && (
                <Alert variant="warning">
                    <AlertTitle>
                        {failed === 1
                            ? i18n.t('One record could not be loaded.')
                            : i18n.t('{{count}} records could not be loaded.', {
                                  count: failed,
                              })}
                    </AlertTitle>
                    <div className="pt-1.5">{retryButton}</div>
                </Alert>
            )}
        </div>
    )
}
