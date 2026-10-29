import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React, { type ReactNode } from 'react'
import type { NodeKind } from '../domain/model'
import {
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'
import { NodeGlyph, radiusOf } from './RelationshipViewerCanvas'

const kindLabels = () =>
    ({
        trackedEntity: i18n.t('Tracked entity'),
        enrollment: i18n.t('Enrollment'),
        event: i18n.t('Event'),
    }) satisfies Record<NodeKind, string>

const Row = ({ icon, children }: { icon: ReactNode; children: ReactNode }) => (
    <li className="flex items-center gap-2">
        <svg
            aria-hidden="true"
            viewBox="-12 -12 24 24"
            className="size-5 shrink-0 text-dhis2-grey-900"
        >
            {icon}
        </svg>
        {children}
    </li>
)

export function RelationshipViewerLegend({
    className,
}: {
    className?: string
}) {
    const { graph } = useRelationshipViewerState()
    const { statuses } = useRelationshipViewerMeta()
    const kinds = new Set(
        [...(graph?.nodes.values() ?? [])].map((n) => n.ref.kind)
    )
    const labels = kindLabels()

    return (
        <ul
            aria-label={i18n.t('Legend')}
            className={cn('flex flex-col gap-1 text-sm', className)}
        >
            {statuses.map((status) => (
                <Row
                    key={status.key}
                    icon={
                        <>
                            {status.attention && (
                                <circle
                                    data-attention-ring=""
                                    r={radiusOf(status) + 3}
                                    fill="none"
                                    strokeWidth={1.5}
                                    className="stroke-dhis2-grey-900"
                                />
                            )}
                            <circle
                                r={radiusOf(status)}
                                style={{ fill: status.color }}
                                className="stroke-dhis2-grey-900"
                            />
                        </>
                    }
                >
                    {status.label}
                </Row>
            ))}
            {(['trackedEntity', 'enrollment', 'event'] as const)
                .filter((kind) => kinds.has(kind))
                .map((kind) => (
                    <Row
                        key={kind}
                        icon={
                            <NodeGlyph
                                kind={kind}
                                r={6}
                                fill="none"
                                className="stroke-dhis2-grey-900"
                            />
                        }
                    >
                        {labels[kind]}
                    </Row>
                ))}
            <Row
                icon={
                    <path
                        d="M-10,0 H6 M2,-4 L8,0 L2,4"
                        fill="none"
                        className="stroke-dhis2-grey-600"
                    />
                }
            >
                {i18n.t('One-way link')}
            </Row>
            <Row
                icon={<path d="M-10,0 H10" className="stroke-dhis2-grey-600" />}
            >
                {i18n.t('Two-way link')}
            </Row>
        </ul>
    )
}
