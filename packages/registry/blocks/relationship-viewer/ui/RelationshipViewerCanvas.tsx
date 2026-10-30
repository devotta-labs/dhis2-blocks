import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import { Spinner } from '@/components/dhis2/ui/spinner'
import i18n from '@dhis2/d2-i18n'
import React, { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { dayDifference } from '../domain/dates'
import type {
    NodeKey,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from '../domain/model'
import { parentsOf } from '../domain/orientation'
import {
    isStackable,
    stackKey,
    stackLeaves,
    type Stack,
    type Stacked,
} from '../domain/stacks'
import type { OutbreakSummary } from '../domain/summary'
import { elbowPath, layoutTrace } from '../layout/trace'
import { layoutWeb, type Bounds, type Point } from '../layout/web'
import {
    useRelationshipViewerActions,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'
import { radiusOf, STACK_RADIUS, type StatusCount } from './glyphs'
import { TraceCard, TraceStack } from './TraceCard'
import { useViewBox } from './useViewBox'
import { WebNode, WebStack } from './WebNode'

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

const LABELLED_SPACE = 36
const MARK_SPACE = 10

const EMPTY_BOUNDS: Bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

export function RelationshipViewerCanvas({
    className,
}: {
    className?: string
}) {
    const { status, graph, fetching, layout, selected } =
        useRelationshipViewerState()
    const { select, expand, retry } = useRelationshipViewerActions()
    const {
        statuses,
        statusOf,
        labelOf,
        dateOf,
        orientation,
        generations,
        summary,
    } = useRelationshipViewerMeta()
    const id = useId().replace(/:/g, '')
    const markerId = `${id}-arrow`
    const [open, setOpen] = useState<ReadonlySet<NodeKey>>(new Set())

    // An equal set of stacks keeps the stacked graph object, so selecting a node outside every stack keeps the layout.
    const last = useRef<{
        graph?: RelationshipGraph
        key: string
        stacked?: Stacked
    }>({ key: '' })
    const stacked = useMemo(() => {
        if (!graph) return undefined
        const next = stackLeaves(
            graph,
            (node) =>
                node.state.status === 'loaded' &&
                isStackable(node, statusOf(node), selected),
            open
        )
        const key = stackKey(next.stacks)
        if (last.current.graph === graph && last.current.key === key) {
            return last.current.stacked
        }
        last.current = { graph, key, stacked: next }
        return next
    }, [graph, statusOf, selected, open])
    const drawnGraph = stacked?.graph
    // The last web picture, so a stack opening or a record expanding grows the picture instead of redrawing it.
    const lastWeb = useRef<ReadonlyMap<NodeKey, Point>>()

    // Only the drawn graph and layout re-run the force simulation; pan, zoom and selection do not.
    const web = useMemo(() => {
        if (!drawnGraph || !stacked || layout !== 'web') return undefined
        // Room for the "12 records" or name label beside stacks, seeds and attention marks; selection does not move anything.
        const next = layoutWeb(
            drawnGraph,
            (key) => {
                const node = drawnGraph.nodes.get(key)
                const labelled =
                    stacked.stacks.has(key) ||
                    node?.seed ||
                    (node?.state.status === 'loaded' &&
                        statusOf(node)?.attention)
                return labelled ? LABELLED_SPACE : MARK_SPACE
            },
            lastWeb.current
        )
        lastWeb.current = next.positions
        return next
    }, [drawnGraph, stacked, layout, statusOf])
    const parents = useMemo(
        () => (drawnGraph ? parentsOf(drawnGraph, orientation) : undefined),
        [drawnGraph, orientation]
    )
    const trace = useMemo(
        () =>
            drawnGraph && parents && layout === 'trace'
                ? layoutTrace(drawnGraph, parents, generations)
                : undefined,
        [drawnGraph, parents, layout, generations]
    )
    const drawn = web ?? trace
    // A new graph or layout is a new scene and refits; redrawing the same one keeps the zoom.
    // A scene is a layout over a set of starting records: expanding, retrying or opening a stack stays in it.
    const scene = useMemo(
        () =>
            `${layout}|${(graph?.order ?? []).filter((key) => graph?.nodes.get(key)?.seed).join(',')}`,
        [graph, layout]
    )
    const { ref, viewBox, fit, shift, handlers } = useViewBox(
        drawn?.bounds ?? EMPTY_BOUNDS,
        scene
    )

    // Keep the record being worked on still: the one just expanded, the stack just opened, or the selection.
    const opened = useRef<NodeKey>()
    const previous = useRef<{
        scene: string
        graph: RelationshipGraph
        positions: ReadonlyMap<NodeKey, Point>
    }>()
    useLayoutEffect(() => {
        const last = previous.current
        previous.current =
            graph && drawn
                ? { scene, graph, positions: drawn.positions }
                : undefined
        if (!last || !drawn || last.scene !== scene) return
        const expanded = [...last.graph.nodes.values()].find(
            (node) =>
                node.stubCount > (graph?.nodes.get(node.key)?.stubCount ?? 0)
        )?.key
        const anchor = expanded ?? opened.current ?? selected
        opened.current = undefined
        const from = anchor && last.positions.get(anchor)
        const to = anchor && drawn.positions.get(anchor)
        if (from && to && (from.x !== to.x || from.y !== to.y)) {
            shift(to.x - from.x, to.y - from.y)
        }
        // Runs once per new drawing; scene, graph and selection are read as they are then.
    }, [drawn])

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
    if (status === 'error' || !graph || !stacked || !drawnGraph || !drawn) {
        return null
    }
    if (graph.nodes.size === 0) {
        return (
            <p className={cn('p-6 text-center text-sm', className)}>
                {i18n.t('Nobody matches these starting points.')}
            </p>
        )
    }

    const { stacks } = stacked
    const nodeStatus = (node: RelationshipNode) =>
        node.state.status === 'loaded' ? statusOf(node) : undefined
    const radius = (key: NodeKey) => {
        const node = drawnGraph.nodes.get(key)
        if (stacks.has(key)) return STACK_RADIUS
        return radiusOf(node && nodeStatus(node))
    }
    const rank = (s: RelationshipStatus | undefined) =>
        s ? statuses.indexOf(s) : statuses.length
    const splitOf = (stack: Stack): StatusCount[] => {
        const counts = new Map<RelationshipStatus | undefined, number>()
        for (const key of stack.members) {
            const node = graph.nodes.get(key)
            const s = node && nodeStatus(node)
            counts.set(s, (counts.get(s) ?? 0) + 1)
        }
        return [...counts]
            .map(([s, count]) => ({ status: s, count }))
            .sort((a, b) => rank(a.status) - rank(b.status))
    }
    const openStack = (hub: NodeKey, standIn: NodeKey) => {
        opened.current = standIn
        setOpen((current) => new Set(current).add(hub))
    }

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
                <g aria-hidden="true" className="stroke-dhis2-grey-500">
                    {[...drawnGraph.edges.values()].map((edge) => {
                        const from = drawn.positions.get(edge.from)
                        const to = drawn.positions.get(edge.to)
                        if (!from || !to) return null
                        const marker = edge.bidirectional
                            ? undefined
                            : `url(#${markerId})`
                        if (trace) {
                            const way = orientation.get(edge.id)
                            return (
                                <path
                                    key={edge.id}
                                    data-edge-id={edge.id}
                                    d={elbowPath(
                                        (way &&
                                            trace.positions.get(way.source)) ??
                                            from,
                                        (way &&
                                            trace.positions.get(way.target)) ??
                                            to
                                    )}
                                    fill="none"
                                    markerEnd={marker}
                                />
                            )
                        }
                        // Stop one-way links at the target's edge so the arrowhead shows.
                        const length = Math.hypot(to.x - from.x, to.y - from.y)
                        const cut = edge.bidirectional
                            ? 0
                            : Math.min(length, radius(edge.to) + 2) /
                              (length || 1)
                        return (
                            <line
                                key={edge.id}
                                data-edge-id={edge.id}
                                x1={from.x}
                                y1={from.y}
                                x2={to.x - (to.x - from.x) * cut}
                                y2={to.y - (to.y - from.y) * cut}
                                markerEnd={marker}
                            />
                        )
                    })}
                </g>
                <g aria-hidden="true">
                    {drawnGraph.order.map((key) => {
                        const node = drawnGraph.nodes.get(key)
                        const at = drawn.positions.get(key)
                        if (!node || !at) return null
                        const stack = stacks.get(key)
                        const place = `translate(${at.x} ${at.y})`
                        if (stack) {
                            const Drawing = trace ? TraceStack : WebStack
                            return (
                                <g key={key} transform={place}>
                                    <Drawing
                                        stack={stack}
                                        split={splitOf(stack)}
                                        onOpen={() => openStack(stack.hub, key)}
                                    />
                                </g>
                            )
                        }
                        const nodeState = nodeStatus(node)
                        const handlers = {
                            onSelect: () => select(key),
                            onExpand: () => expand(key),
                            onRetry: () => retry(key),
                        }
                        if (trace) {
                            const parent = parents?.get(key)
                            const parentNode = parent && graph.nodes.get(parent)
                            const date = dateOf(node)
                            return (
                                <g key={key} transform={place}>
                                    <TraceCard
                                        node={node}
                                        label={labelOf(node)}
                                        status={nodeState}
                                        date={date}
                                        days={
                                            parentNode
                                                ? dayDifference(
                                                      dateOf(parentNode),
                                                      date
                                                  )
                                                : undefined
                                        }
                                        selected={key === selected}
                                        {...handlers}
                                    />
                                </g>
                            )
                        }
                        return (
                            <g key={key} transform={place}>
                                <WebNode
                                    node={node}
                                    label={labelOf(node)}
                                    status={nodeState}
                                    selected={key === selected}
                                    named={
                                        node.seed ||
                                        !!nodeState?.attention ||
                                        key === selected
                                    }
                                    {...handlers}
                                />
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
