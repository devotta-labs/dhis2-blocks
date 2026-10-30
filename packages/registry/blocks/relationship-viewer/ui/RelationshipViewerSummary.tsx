import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type { OutbreakSummary } from '../domain/summary'
import {
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'

// Each count gets its own singular and plural key: i18next 10 has no plural fallback for an untranslated key.
const partialNote = ({
    unloadedLinkCount,
    unloadedNodeCount,
}: OutbreakSummary) => {
    if (unloadedLinkCount === 0) {
        return i18n.t('Partial: some links are not loaded.')
    }
    return i18n.t('{{links}} not loaded on {{records}}.', {
        links:
            unloadedLinkCount === 1
                ? i18n.t('One link')
                : i18n.t('{{count}} links', { count: unloadedLinkCount }),
        records:
            unloadedNodeCount === 1
                ? i18n.t('one record')
                : i18n.t('{{count}} records', { count: unloadedNodeCount }),
        interpolation: { escapeValue: false },
    })
}

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
                <p className="text-dhis2-grey-700">{partialNote(summary)}</p>
            )}
        </div>
    )
}
