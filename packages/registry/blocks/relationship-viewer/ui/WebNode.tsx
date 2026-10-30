import i18n from '@dhis2/d2-i18n'
import React from 'react'
import type { RelationshipNode, RelationshipStatus } from '../domain/model'
import type { Stack } from '../domain/stacks'
import {
    NO_STATUS_FILL,
    NodeGlyph,
    radiusOf,
    SeedMark,
    STACK_RADIUS,
    StubBadge,
    type StatusCount,
} from './glyphs'
import { truncate } from './TraceCard'

const RING_GAP = 3
const HALO = {
    paintOrder: 'stroke',
    stroke: 'white',
    strokeWidth: 3,
} as const

export function WebNode({
    node,
    label,
    status,
    selected,
    named,
    onSelect,
    onExpand,
    onRetry,
}: {
    node: RelationshipNode
    label: string
    status: RelationshipStatus | undefined
    selected: boolean
    named: boolean // seed, attention or selected
    onSelect(): void
    onExpand(): void
    onRetry(): void
}) {
    const kind = node.ref.kind
    const r = radiusOf(status)
    if (node.state.status === 'failed') {
        return (
            <g
                data-node-key={node.key}
                data-failed=""
                className="cursor-pointer"
                onClick={onRetry}
            >
                <title>{label}</title>
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
    return (
        <g
            data-node-key={node.key}
            className="cursor-pointer"
            onClick={onSelect}
        >
            <title>{label}</title>
            {status?.attention && (
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
                style={{ fill: status?.color ?? NO_STATUS_FILL }}
                strokeWidth={selected ? 2.5 : 1}
                className={
                    selected ? 'stroke-dhis2-blue-600' : 'stroke-dhis2-grey-900'
                }
            />
            {node.seed && <SeedMark r={r + RING_GAP} />}
            {named && (
                <text
                    data-label=""
                    x={r + RING_GAP + 3}
                    dominantBaseline="central"
                    style={HALO}
                    className="fill-dhis2-grey-900 text-[10px]"
                >
                    {truncate(label)}
                </text>
            )}
            {node.stubCount > 0 && (
                <StubBadge
                    count={node.stubCount}
                    x={r + 6}
                    y={-r - 6}
                    onExpand={onExpand}
                />
            )}
        </g>
    )
}

const arc = (from: number, to: number, r: number): string => {
    const point = (turn: number) =>
        `${r * Math.sin(turn * 2 * Math.PI)},${-r * Math.cos(turn * 2 * Math.PI)}`
    return `M0,0 L${point(from)} A${r},${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${point(to)} Z`
}

/** Status segments of one disc of radius `r`, in `split` order. */
export function StatusPie({
    split,
    r,
}: {
    split: readonly StatusCount[]
    r: number
}) {
    const total = split.reduce((sum, { count }) => sum + count, 0)
    let at = 0
    return (
        <g className="stroke-dhis2-grey-900">
            {split.map(({ status, count }) => {
                const from = at / total
                at += count
                const fill = status?.color ?? NO_STATUS_FILL
                return count === total ? (
                    <circle key="all" r={r} style={{ fill }} />
                ) : (
                    <path
                        key={status?.key ?? ''}
                        d={arc(from, at / total, r)}
                        style={{ fill }}
                        strokeWidth={0.5}
                    />
                )
            })}
            <circle r={r} fill="none" />
        </g>
    )
}

/** Several leaf contacts as one stacked disc with a count; clicking opens it. */
export function WebStack({
    stack,
    split,
    onOpen,
}: {
    stack: Stack
    split: readonly StatusCount[]
    onOpen(): void
}) {
    return (
        <g data-stack="" className="cursor-pointer" onClick={onOpen}>
            <title>
                {i18n.t('{{count}} records', { count: stack.members.length })}
            </title>
            {[4, 2].map((offset) => (
                <circle
                    key={offset}
                    r={STACK_RADIUS}
                    cx={offset}
                    cy={-offset}
                    className="fill-white stroke-dhis2-grey-500"
                />
            ))}
            <StatusPie split={split} r={STACK_RADIUS} />
            <text
                x={STACK_RADIUS + 8}
                dominantBaseline="central"
                style={HALO}
                className="fill-dhis2-grey-900 text-[10px]"
            >
                {i18n.t('{{count}} records', { count: stack.members.length })}
            </text>
        </g>
    )
}
