import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import i18n from '@dhis2/d2-i18n'
import React, { useId, useMemo, type SVGAttributes } from 'react'
import type {
    NodeKind,
    RelationshipNode,
    RelationshipStatus,
} from '../domain/model'
import { timelineParents } from '../domain/orientation'
import type { OutbreakSummary } from '../domain/summary'
import { layoutTimeline, type TimelineLayout } from '../layout/timeline'
import { layoutWeb, type Bounds } from '../layout/web'
import {
    useRelationshipViewerActions,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'
import { useViewBox } from './useViewBox'

const NO_STATUS_FILL = 'var(--color-dhis2-grey-500)'
const RING_GAP = 3
// Room above and right of the nodes for the 45° timeline date labels.
const AXIS_HEIGHT = 56

export const radiusOf = (status: RelationshipStatus | undefined) =>
    status?.size === 'large' ? 9 : 5

/** Tracked entity = circle, enrollment = square, event = diamond; `r` is the half-width. */
export function NodeGlyph({
    kind,
    r,
    ...props
}: { kind: NodeKind; r: number } & SVGAttributes<SVGElement>) {
    if (kind === 'enrollment') {
        return <rect {...props} x={-r} y={-r} width={2 * r} height={2 * r} />
    }
    if (kind === 'event') {
        return <polygon {...props} points={`0,${-r} ${r},0 0,${r} ${-r},0`} />
    }
    return <circle {...props} r={r} />
}

// Each count gets its own singular and plural key: i18next 10 has no plural fallback for an untranslated key.
const describe = (summary: OutbreakSummary) => {
    const { nodeCount, clusterCount, generationCount, attentionCount } = summary
    const values = {
        records:
            nodeCount === 1
                ? i18n.t('One record')
                : i18n.t('{{count}} records', { count: nodeCount }),
        clusters:
            clusterCount === 1
                ? i18n.t('one cluster')
                : i18n.t('{{count}} clusters', { count: clusterCount }),
        generations:
            generationCount === 1
                ? i18n.t('one generation')
                : i18n.t('{{count}} generations', { count: generationCount }),
        attention:
            attentionCount === 1
                ? i18n.t('one needs attention')
                : i18n.t('{{count}} need attention', { count: attentionCount }),
    }
    return summary.partial
        ? i18n.t(
              '{{records}} in {{clusters}} over {{generations}}; {{attention}}; some links are not loaded.',
              { ...values, interpolation: { escapeValue: false } }
          )
        : i18n.t(
              '{{records}} in {{clusters}} over {{generations}}; {{attention}}.',
              { ...values, interpolation: { escapeValue: false } }
          )
}

const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

export function RelationshipViewerCanvas({
    className,
}: {
    className?: string
}) {
    const { status, graph, fetching, layout, selected } =
        useRelationshipViewerState()
    const { select, expand, retry } = useRelationshipViewerActions()
    const { statusOf, labelOf, dateOf, orientation, summary } =
        useRelationshipViewerMeta()
    const id = useId().replace(/:/g, '')
    const markerId = `${id}-arrow`

    // Only the graph and layout re-run the force simulation; pan, zoom and selection do not.
    const web = useMemo(
        () => (graph && layout === 'web' ? layoutWeb(graph) : undefined),
        [graph, layout]
    )
    const timeline = useMemo<TimelineLayout | undefined>(
        () =>
            graph && layout === 'timeline'
                ? layoutTimeline(
                      graph,
                      timelineParents(graph, orientation),
                      dateOf
                  )
                : undefined,
        [graph, layout, orientation, dateOf]
    )
    const drawn = web ?? timeline
    const fitBounds = useMemo(
        () =>
            timeline
                ? {
                      ...timeline.bounds,
                      minY: timeline.bounds.minY - AXIS_HEIGHT,
                      maxX: timeline.bounds.maxX + AXIS_HEIGHT,
                  }
                : (drawn?.bounds ?? EMPTY_BOUNDS),
        [drawn, timeline]
    )
    const { ref, viewBox, fit, handlers } = useViewBox(fitBounds)

    if (status === 'loading') {
        return (
            <div className={cn('flex justify-center p-6', className)}>
                <Spinner
                    aria-label={i18n.t('Loading')}
                    className="size-12 border-6"
                />
            </div>
        )
    }
    if (status === 'error' || !graph || !drawn) return null
    if (graph.nodes.size === 0) {
        return (
            <p className={cn('p-6 text-center text-sm', className)}>
                {i18n.t('Nobody matches these starting points.')}
            </p>
        )
    }

    const nodeStatus = (node: RelationshipNode) =>
        node.state.status === 'loaded' ? statusOf(node) : undefined
    const radius = (node: RelationshipNode) => radiusOf(nodeStatus(node))
    const axisY = fitBounds.minY + AXIS_HEIGHT - 16

    return (
        <div className={cn('relative h-96 w-full', className)}>
            <svg
                ref={ref}
                role="img"
                aria-label={i18n.t('Relationship graph')}
                aria-describedby={`${id}-desc`}
                aria-busy={fetching}
                viewBox={viewBox}
                className="size-full cursor-grab touch-none select-none"
                {...handlers}
            >
                <desc id={`${id}-desc`}>{describe(summary)}</desc>
                <defs aria-hidden="true">
                    <marker
                        id={markerId}
                        viewBox="0 0 10 10"
                        refX="10"
                        refY="5"
                        markerWidth="6"
                        markerHeight="6"
                        orient="auto-start-reverse"
                    >
                        <path
                            d="M0,0 L10,5 L0,10 z"
                            className="fill-dhis2-grey-600"
                        />
                    </marker>
                </defs>
                {timeline && (
                    <g aria-hidden="true" className="text-[10px]">
                        {timeline.ticks.map((tick) => (
                            <g key={tick.x}>
                                <line
                                    x1={tick.x}
                                    x2={tick.x}
                                    y1={axisY}
                                    y2={fitBounds.maxY}
                                    className="stroke-dhis2-grey-300"
                                />
                                <text
                                    x={tick.x}
                                    y={axisY - 4}
                                    transform={`rotate(-45 ${tick.x} ${axisY - 4})`}
                                    className="fill-dhis2-grey-700"
                                >
                                    {tick.label}
                                </text>
                            </g>
                        ))}
                        {timeline.noDateLaneX !== undefined && (
                            <g>
                                <line
                                    x1={timeline.noDateLaneX}
                                    x2={timeline.noDateLaneX}
                                    y1={axisY}
                                    y2={fitBounds.maxY}
                                    strokeDasharray="3 3"
                                    className="stroke-dhis2-grey-400"
                                />
                                <text
                                    x={timeline.noDateLaneX}
                                    y={axisY - 4}
                                    textAnchor="middle"
                                    className="fill-dhis2-grey-700"
                                >
                                    {i18n.t('No date')}
                                </text>
                            </g>
                        )}
                    </g>
                )}
                <g aria-hidden="true" className="stroke-dhis2-grey-500">
                    {[...graph.edges.values()].map((edge) => {
                        const from = drawn.positions.get(edge.from)
                        const to = drawn.positions.get(edge.to)
                        const target = graph.nodes.get(edge.to)
                        if (!from || !to || !target) return null
                        // Stop one-way links at the target's edge so the arrowhead shows.
                        const length = Math.hypot(to.x - from.x, to.y - from.y)
                        const cut = edge.bidirectional
                            ? 0
                            : Math.min(length, radius(target) + 2) /
                              (length || 1)
                        return (
                            <line
                                key={edge.id}
                                data-edge-id={edge.id}
                                x1={from.x}
                                y1={from.y}
                                x2={to.x - (to.x - from.x) * cut}
                                y2={to.y - (to.y - from.y) * cut}
                                markerEnd={
                                    edge.bidirectional
                                        ? undefined
                                        : `url(#${markerId})`
                                }
                            />
                        )
                    })}
                </g>
                <g aria-hidden="true">
                    {graph.order.map((key) => {
                        const node = graph.nodes.get(key)
                        const at = drawn.positions.get(key)
                        if (!node || !at) return null
                        const kind = node.ref.kind
                        const r = radius(node)
                        if (node.state.status === 'failed') {
                            return (
                                <g
                                    key={key}
                                    data-node-key={key}
                                    data-failed=""
                                    transform={`translate(${at.x} ${at.y})`}
                                    className="cursor-pointer"
                                    onClick={() => retry(key)}
                                >
                                    <title>{labelOf(node)}</title>
                                    <NodeGlyph
                                        data-glyph=""
                                        kind={kind}
                                        r={r}
                                        fill="transparent"
                                        strokeDasharray="2 2"
                                        className="stroke-dhis2-grey-500"
                                    />
                                </g>
                            )
                        }
                        const nodeState = nodeStatus(node)
                        const emphasised = node.seed || key === selected
                        return (
                            <g
                                key={key}
                                data-node-key={key}
                                transform={`translate(${at.x} ${at.y})`}
                                className="cursor-pointer"
                                onClick={() => select(key)}
                            >
                                <title>{labelOf(node)}</title>
                                {nodeState?.attention && (
                                    <NodeGlyph
                                        data-attention-ring=""
                                        kind={kind}
                                        r={r + RING_GAP}
                                        fill="none"
                                        strokeWidth={1.5}
                                        className="stroke-dhis2-grey-900"
                                    />
                                )}
                                <NodeGlyph
                                    data-glyph=""
                                    kind={kind}
                                    r={r}
                                    style={{
                                        fill:
                                            nodeState?.color ?? NO_STATUS_FILL,
                                    }}
                                    strokeWidth={emphasised ? 2.5 : 1}
                                    className={
                                        key === selected
                                            ? 'stroke-dhis2-blue-600'
                                            : 'stroke-dhis2-grey-900'
                                    }
                                />
                                {node.stubCount > 0 && (
                                    <g
                                        data-stub=""
                                        transform={`translate(${r + 6} ${-r - 6})`}
                                        onClick={(event) => {
                                            event.stopPropagation()
                                            expand(key)
                                        }}
                                    >
                                        <rect
                                            x={-9}
                                            y={-6}
                                            width={18}
                                            height={12}
                                            rx={6}
                                            className="fill-dhis2-grey-100 stroke-dhis2-grey-500"
                                        />
                                        <text
                                            textAnchor="middle"
                                            dominantBaseline="central"
                                            className="fill-dhis2-grey-900 text-[8px]"
                                        >
                                            {i18n.t('+{{stubs}}', {
                                                stubs: node.stubCount,
                                            })}
                                        </text>
                                    </g>
                                )}
                            </g>
                        )
                    })}
                </g>
            </svg>
            {fetching && (
                <Spinner
                    aria-label={i18n.t('Loading')}
                    className="absolute top-2 left-2"
                />
            )}
            <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={fit}
            >
                {i18n.t('Fit')}
            </Button>
        </div>
    )
}
