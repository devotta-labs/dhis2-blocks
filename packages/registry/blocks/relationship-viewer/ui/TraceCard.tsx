import i18n from '@dhis2/d2-i18n'
import React, { useId } from 'react'
import { isoDay } from '../domain/dates'
import type { RelationshipNode, RelationshipStatus } from '../domain/model'
import type { Stack } from '../domain/stacks'
import { CARD_HEIGHT, CARD_WIDTH } from '../layout/trace'
import {
    NO_STATUS_FILL,
    NodeGlyph,
    SeedMark,
    StubBadge,
    type StatusCount,
} from './glyphs'

const LEFT = -CARD_WIDTH / 2
const RADIUS = 6

/** The card's rounded shape, for clipping its status bar so the outline stays on top. */
const CardClip = ({ id }: { id: string }) => (
    <clipPath id={id}>
        <rect
            x={LEFT}
            y={-CARD_HEIGHT / 2}
            width={CARD_WIDTH}
            height={CARD_HEIGHT}
            rx={RADIUS}
        />
    </clipPath>
)
const TOP = -CARD_HEIGHT / 2
const BAR = 4

export const truncate = (text: string, max = 24): string =>
    text.length > max ? `${text.slice(0, max)}…` : text

// Each count gets its own key: i18next 10 has no plural fallback for an untranslated key.
const daysText = (days: number): string => {
    if (days === 0) return i18n.t('Same day')
    if (days === 1) return i18n.t('+1 day')
    if (days === -1) return i18n.t('−1 day')
    return days > 0
        ? i18n.t('+{{count}} days', { count: days })
        : i18n.t('−{{count}} days', { count: -days })
}

/** One node as a card centred on (0, 0); the caller translates it into place. */
export function TraceCard({
    node,
    label,
    status,
    date,
    days,
    selected,
    startsChain,
    onSelect,
    onExpand,
    onRetry,
}: {
    node: RelationshipNode
    label: string
    status: RelationshipStatus | undefined
    date: Date | undefined
    days: number | undefined
    selected: boolean
    startsChain: boolean // a starting record nothing drawn leads to
    onSelect(): void
    onExpand(): void
    onRetry(): void
}) {
    const failed = node.state.status === 'failed'
    const statusLine = failed
        ? i18n.t('Could not load. Select to retry.')
        : truncate(status?.label ?? '', 27)
    const dateLine = [
        date && isoDay(date),
        days === undefined ? undefined : daysText(days),
    ]
        .filter(Boolean)
        .join(' · ')
    const attention = !failed && status?.attention
    const clip = `${useId().replace(/:/g, '')}-clip`

    let border = { width: 1, className: 'stroke-dhis2-grey-400' }
    if (selected) border = { width: 2.5, className: 'stroke-dhis2-blue-600' }
    else if (attention)
        border = { width: 2, className: 'stroke-dhis2-grey-900' }

    return (
        <g
            data-trace-card=""
            data-node-key={node.key}
            data-failed={failed ? '' : undefined}
            className="cursor-pointer"
            onClick={failed ? onRetry : onSelect}
        >
            <title>{label}</title>
            <rect
                x={LEFT}
                y={TOP}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={RADIUS}
                className="fill-white"
            />
            {!failed && (
                <>
                    <CardClip id={clip} />
                    <rect
                        data-status-bar=""
                        clipPath={`url(#${clip})`}
                        x={LEFT}
                        y={TOP}
                        width={BAR}
                        height={CARD_HEIGHT}
                        style={{ fill: status?.color ?? NO_STATUS_FILL }}
                    />
                </>
            )}
            <rect
                data-card-outline=""
                data-attention-ring={attention ? '' : undefined}
                x={LEFT}
                y={TOP}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={RADIUS}
                fill="none"
                strokeWidth={border.width}
                strokeDasharray={failed ? '4 3' : undefined}
                className={border.className}
            />
            <NodeGlyph
                kind={node.ref.kind}
                r={4}
                transform={`translate(${LEFT + 16} -18)`}
                fill="none"
                className="stroke-dhis2-grey-700"
            />
            <text
                x={LEFT + 26}
                y={-14}
                className="fill-dhis2-grey-900 text-[12px] font-medium"
            >
                {truncate(label)}
            </text>
            <text
                x={LEFT + 12}
                y={3}
                className="fill-dhis2-grey-700 text-[11px]"
            >
                {statusLine}
            </text>
            <text
                x={LEFT + 12}
                y={19}
                className="fill-dhis2-grey-700 text-[11px] tabular-nums"
            >
                {dateLine}
            </text>
            {startsChain && (
                <g transform={`translate(${LEFT} ${-TOP})`}>
                    <SeedMark r={0} />
                </g>
            )}
            {node.stubCount > 0 && (
                <StubBadge
                    count={node.stubCount}
                    x={CARD_WIDTH / 2}
                    y={0}
                    onExpand={onExpand}
                />
            )}
        </g>
    )
}

/** Several leaf contacts as one card with their status split; clicking opens it. */
export function TraceStack({
    stack,
    split,
    onOpen,
}: {
    stack: Stack
    split: readonly StatusCount[]
    onOpen(): void
}) {
    const total = stack.members.length
    const clip = `${useId().replace(/:/g, '')}-clip`
    let at = 0
    return (
        <g data-stack="" className="cursor-pointer" onClick={onOpen}>
            {[6, 3].map((offset) => (
                <rect
                    key={offset}
                    x={LEFT + offset}
                    y={TOP - offset}
                    width={CARD_WIDTH}
                    height={CARD_HEIGHT}
                    rx={6}
                    className="fill-white stroke-dhis2-grey-400"
                />
            ))}
            <rect
                x={LEFT}
                y={TOP}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={RADIUS}
                className="fill-white"
            />
            <CardClip id={clip} />
            {split.map(({ status, count }) => {
                const y = TOP + (at / total) * CARD_HEIGHT
                at += count
                return (
                    <rect
                        key={status?.key ?? ''}
                        data-status-bar=""
                        clipPath={`url(#${clip})`}
                        x={LEFT}
                        y={y}
                        width={BAR}
                        height={(count / total) * CARD_HEIGHT}
                        style={{ fill: status?.color ?? NO_STATUS_FILL }}
                    />
                )
            })}
            <rect
                data-card-outline=""
                x={LEFT}
                y={TOP}
                width={CARD_WIDTH}
                height={CARD_HEIGHT}
                rx={RADIUS}
                fill="none"
                className="stroke-dhis2-grey-400"
            />
            <text
                x={LEFT + 12}
                y={-14}
                className="fill-dhis2-grey-900 text-[12px] font-medium"
            >
                {i18n.t('{{count}} records', { count: total })}
            </text>
            <text
                x={LEFT + 12}
                y={3}
                className="fill-dhis2-grey-700 text-[11px]"
            >
                {split
                    .map(({ status, count }) =>
                        i18n.t('{{count}} {{status}}', {
                            count,
                            status: status?.label ?? i18n.t('No status'),
                            interpolation: { escapeValue: false },
                        })
                    )
                    .join(' · ')}
            </text>
        </g>
    )
}
