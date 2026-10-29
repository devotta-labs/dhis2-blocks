import { Button } from '@/components/dhis2/ui/button'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/dhis2/ui/table'
import i18n from '@dhis2/d2-i18n'
import React, { useEffect, useMemo, useRef } from 'react'
import type { NodeKey } from '../domain/model'
import {
    useRelationshipViewerActions,
    useRelationshipViewerMeta,
    useRelationshipViewerState,
} from '../provider/RelationshipViewerContext'

/** The accessible equivalent of the canvas: the same nodes and links, operable from the keyboard. */
export function RelationshipViewerList({ className }: { className?: string }) {
    const { graph, fetching, selected } = useRelationshipViewerState()
    const { select, expand, retry } = useRelationshipViewerActions()
    const { statusOf, labelOf } = useRelationshipViewerMeta()
    const selectedRow = useRef<HTMLButtonElement>(null)

    // Only a change of selection scrolls, not every render.
    useEffect(() => {
        selectedRow.current?.scrollIntoView({ block: 'nearest' })
    }, [selected])

    const attention = (key: NodeKey) => {
        const node = graph?.nodes.get(key)
        return node?.state.status === 'loaded' &&
            statusOf(node)?.attention === true
            ? 0
            : 1
    }
    // Array.sort is stable, so discovery order holds within each group.
    const rows = [...(graph?.order ?? [])].sort(
        (a, b) => attention(a) - attention(b)
    )
    const linked = useMemo(() => {
        const byNode = new Map<NodeKey, { count: number; far: Set<NodeKey> }>()
        const of = (key: NodeKey) => {
            const entry = byNode.get(key) ?? { count: 0, far: new Set() }
            byNode.set(key, entry)
            return entry
        }
        for (const edge of graph?.edges.values() ?? []) {
            const from = of(edge.from)
            from.count++
            from.far.add(edge.to)
            const to = of(edge.to)
            to.count++
            to.far.add(edge.from)
        }
        return byNode
    }, [graph])

    if (!graph) return null
    if (graph.nodes.size === 0) {
        return (
            <p className={cn('p-6 text-center text-sm', className)}>
                {i18n.t('Nobody matches these starting points.')}
            </p>
        )
    }

    return (
        <Table
            aria-label={i18n.t('Records in the relationship graph')}
            aria-busy={fetching}
            className={className}
        >
            <TableHeader>
                <TableRow>
                    <TableHead>{i18n.t('Name')}</TableHead>
                    <TableHead>{i18n.t('Status')}</TableHead>
                    <TableHead>{i18n.t('Hop')}</TableHead>
                    <TableHead>{i18n.t('Links')}</TableHead>
                    <TableHead>{i18n.t('Linked to')}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {rows.map((key) => {
                    const node = graph.nodes.get(key)
                    if (!node) return null
                    const failed = node.state.status === 'failed'
                    const status = failed ? undefined : statusOf(node)
                    const { count = 0, far = new Set<NodeKey>() } =
                        linked.get(key) ?? {}
                    return (
                        <TableRow
                            key={key}
                            data-node-key={key}
                            aria-selected={key === selected}
                            data-state={
                                key === selected ? 'selected' : undefined
                            }
                            className="cursor-pointer"
                            onClick={() => select(key)}
                        >
                            <TableCell>
                                {/* The click bubbles to the row, which selects. */}
                                {/* TableRow does not forward refs (React 18), so the name button stands in for its row. */}
                                <Button
                                    ref={
                                        key === selected
                                            ? selectedRow
                                            : undefined
                                    }
                                    variant="link"
                                    size="sm"
                                    aria-current={key === selected || undefined}
                                >
                                    {labelOf(node)}
                                </Button>
                            </TableCell>
                            <TableCell>
                                {failed ? (
                                    <span className="inline-flex items-center gap-2">
                                        {i18n.t('Could not load')}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            aria-label={i18n.t(
                                                'Retry {{name}}',
                                                {
                                                    name: labelOf(node),
                                                    interpolation: {
                                                        escapeValue: false,
                                                    },
                                                }
                                            )}
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                retry(key)
                                            }}
                                        >
                                            {i18n.t('Retry')}
                                        </Button>
                                    </span>
                                ) : (
                                    status?.label
                                )}
                            </TableCell>
                            <TableCell>{node.hop}</TableCell>
                            <TableCell>
                                <div className="flex flex-col items-start gap-1">
                                    <span>{count}</span>
                                    {node.stubCount > 0 && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            aria-label={
                                                node.stubCount === 1
                                                    ? i18n.t(
                                                          'Show one more for {{name}}',
                                                          {
                                                              name: labelOf(
                                                                  node
                                                              ),
                                                              interpolation: {
                                                                  escapeValue: false,
                                                              },
                                                          }
                                                      )
                                                    : i18n.t(
                                                          'Show {{count}} more for {{name}}',
                                                          {
                                                              count: node.stubCount,
                                                              name: labelOf(
                                                                  node
                                                              ),
                                                              interpolation: {
                                                                  escapeValue: false,
                                                              },
                                                          }
                                                      )
                                            }
                                            onClick={(event) => {
                                                event.stopPropagation()
                                                expand(key)
                                            }}
                                        >
                                            {node.stubCount === 1
                                                ? i18n.t('Show one more')
                                                : i18n.t(
                                                      'Show {{count}} more',
                                                      {
                                                          count: node.stubCount,
                                                      }
                                                  )}
                                        </Button>
                                    )}
                                    {node.otherLinkCount > 0 && (
                                        <span>
                                            {node.otherLinkCount === 1
                                                ? i18n.t(
                                                      'One other link not shown'
                                                  )
                                                : i18n.t(
                                                      '{{count}} other links not shown',
                                                      {
                                                          count: node.otherLinkCount,
                                                      }
                                                  )}
                                        </span>
                                    )}
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex flex-wrap gap-1">
                                    {[...far].map((farKey) => {
                                        const other = graph.nodes.get(farKey)
                                        return (
                                            other && (
                                                <Button
                                                    key={farKey}
                                                    variant="link"
                                                    size="sm"
                                                    onClick={(event) => {
                                                        event.stopPropagation()
                                                        select(farKey)
                                                    }}
                                                >
                                                    {labelOf(other)}
                                                </Button>
                                            )
                                        )
                                    })}
                                </div>
                            </TableCell>
                        </TableRow>
                    )
                })}
            </TableBody>
        </Table>
    )
}
