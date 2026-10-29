import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import {
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'

export function RelationshipViewerSummary({
    className,
}: {
    className?: string
}) {
    const { graph } = useRelationshipViewerState()
    const { summary } = useRelationshipViewerMeta()
    if (!graph) return null

    const rows: [string, number][] = [
        [i18n.t('Records'), summary.nodeCount],
        ...summary.statusCounts.map(({ status, count }): [string, number] => [
            status.label,
            count,
        ]),
        [i18n.t('Need attention'), summary.attentionCount],
        [i18n.t('Clusters'), summary.clusterCount],
        [i18n.t('Largest cluster'), summary.largestCluster],
        [i18n.t('Generations'), summary.generationCount],
        [i18n.t('Most links out'), summary.maxOut],
        [i18n.t('Mean links out'), summary.meanOut],
    ]

    return (
        <div className={cn('flex flex-col gap-2 text-sm', className)}>
            <dl className="grid grid-cols-[auto_auto] justify-start gap-x-4 gap-y-1">
                {rows.map(([label, value]) => (
                    <div key={label} className="contents">
                        <dt className="text-dhis2-grey-700">{label}</dt>
                        <dd className="font-medium tabular-nums">{value}</dd>
                    </div>
                ))}
            </dl>
            {summary.partial && (
                <p className="text-dhis2-grey-700">
                    {i18n.t('Partial: some links are not loaded.')}
                </p>
            )}
        </div>
    )
}
