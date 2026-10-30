import React, { useMemo, useState, type ReactNode } from 'react'
import { labelsOf } from '../domain/labels'
import type {
    DateOf,
    NodeKey,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from '../domain/model'
import { generations, orientEdges } from '../domain/orientation'
import { defaultDateOf } from '../domain/rules'
import { summarize } from '../domain/summary'
import type {
    RelationshipViewerActions,
    RelationshipViewerLayout,
    RelationshipViewerMeta,
    RelationshipViewerSeeds,
    RelationshipViewerState,
} from '../provider/contracts'
import { RelationshipViewerProvider } from '../provider/RelationshipViewerContext'
import { useRelationshipGraph } from '../provider/useRelationshipGraph'

const EMPTY_GRAPH: RelationshipGraph = {
    nodes: new Map(),
    edges: new Map(),
    order: [],
    capped: false,
}

export interface RelationshipViewerProps {
    seeds: RelationshipViewerSeeds
    program?: string
    hops?: number
    cap?: number
    followTypes?: readonly string[]
    statuses: readonly RelationshipStatus[]
    statusOf(node: RelationshipNode): string
    dateOf?: DateOf
    labelOf?: (node: RelationshipNode, defaultLabel: string) => string
    layout?: RelationshipViewerLayout
    onLayoutChange?: (layout: RelationshipViewerLayout) => void
    selected?: NodeKey
    onSelectedChange?: (key: NodeKey | undefined) => void
    children: ReactNode
}

export function RelationshipViewer(props: RelationshipViewerProps) {
    const {
        seeds,
        program,
        hops = 1,
        cap = 500,
        followTypes,
        statuses,
        statusOf,
        labelOf,
        onLayoutChange,
        onSelectedChange,
        children,
    } = props
    const {
        status,
        error,
        graph,
        metadata,
        fetching,
        program: readProgram,
        expand,
        retry,
    } = useRelationshipGraph({ seeds, program, hops, cap, followTypes })

    const [localLayout, setLocalLayout] =
        useState<RelationshipViewerLayout>('web')
    const [localSelected, setLocalSelected] = useState<NodeKey>()
    // Controlled when the prop is passed, even as undefined (no selection).
    const layout = 'layout' in props ? (props.layout ?? 'web') : localLayout
    const selected = 'selected' in props ? props.selected : localSelected

    const actions = useMemo<RelationshipViewerActions>(
        () => ({
            setLayout: (next) => {
                setLocalLayout(next)
                onLayoutChange?.(next)
            },
            select: (key) => {
                setLocalSelected(key)
                onSelectedChange?.(key)
            },
            expand,
            retry,
        }),
        [onLayoutChange, onSelectedChange, expand, retry]
    )

    const dateOf = useMemo<DateOf>(() => {
        const read = props.dateOf ?? defaultDateOf(readProgram)
        // An unparseable date is no date: the card shows none and orientation falls back to discovery order.
        return (node) => {
            const date = read(node)
            return date && !Number.isNaN(date.getTime()) ? date : undefined
        }
    }, [props.dateOf, readProgram])
    const meta = useMemo<RelationshipViewerMeta>(() => {
        const drawn = graph ?? EMPTY_GRAPH
        const orientation = orientEdges(drawn, dateOf)
        const gens = generations(drawn, orientation)
        const labels = metadata && labelsOf(drawn, metadata)
        return {
            statuses,
            statusOf: (node) => {
                const key = statusOf(node)
                return statuses.find((s) => s.key === key)
            },
            labelOf: (node) => {
                const base = labels?.get(node.key) ?? node.ref.id
                return labelOf ? labelOf(node, base) : base
            },
            dateOf,
            orientation,
            generations: gens,
            summary: summarize(drawn, orientation, gens, statusOf, statuses),
            cap,
        }
    }, [graph, metadata, dateOf, statuses, statusOf, labelOf, cap])

    const state = useMemo<RelationshipViewerState>(
        () => ({ status, error, graph, fetching, layout, selected }),
        [status, error, graph, fetching, layout, selected]
    )

    return (
        <RelationshipViewerProvider state={state} actions={actions} meta={meta}>
            {children}
        </RelationshipViewerProvider>
    )
}
