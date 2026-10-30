import i18n from '@dhis2/d2-i18n'
import React, { type SVGAttributes } from 'react'
import type { NodeKind, RelationshipStatus } from '../domain/model'

export const NO_STATUS_FILL = 'var(--color-dhis2-grey-500)'
export const STACK_RADIUS = 9

export interface StatusCount {
    status: RelationshipStatus | undefined
    count: number
}

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

/** The "+N" badge for links not drawn; clicking expands without selecting. */
export function StubBadge({
    count,
    x,
    y,
    onExpand,
}: {
    count: number
    x: number
    y: number
    onExpand(): void
}) {
    return (
        <g
            data-stub=""
            transform={`translate(${x} ${y})`}
            onClick={(event) => {
                event.stopPropagation()
                onExpand()
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
                {i18n.t('+{{stubs}}', { stubs: count })}
            </text>
        </g>
    )
}

/** The pedigree proband arrow: a short arrow from lower left pointing at a node of half-width `r`. */
export function SeedMark({ r, length = 10 }: { r: number; length?: number }) {
    const tip = r * Math.SQRT1_2 + 2
    const tail = tip + length
    return (
        <g data-seed-mark="" className="stroke-dhis2-grey-900">
            <path d={`M${-tail},${tail} L${-tip},${tip}`} strokeWidth={1.5} />
            <path
                d={`M${-tip},${tip} l-5.5,0.5 l5,-5 z`}
                className="fill-dhis2-grey-900"
                strokeWidth={1}
            />
        </g>
    )
}
