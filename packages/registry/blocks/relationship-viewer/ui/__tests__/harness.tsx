import React, { useState, type ReactNode } from 'react'
import { render } from 'vitest-browser-react'
import type {
    DateOf,
    NodeKey,
    NodeRecord,
    RelationshipGraph,
    RelationshipNode,
    RelationshipStatus,
} from '../../domain/model'
import { generations, orientEdges } from '../../domain/orientation'
import { summarize } from '../../domain/summary'
import { traverse } from '../../domain/traverse'
import { fakeFetch } from '../../__tests__/fixtures'
import { dateOf as fixtureDateOf } from '../../__tests__/graph'
import type {
    RelationshipViewerActions,
    RelationshipViewerLayout,
    RelationshipViewerMeta,
    RelationshipViewerState,
} from '../../provider/contracts'
import { RelationshipViewerProvider } from '../../provider/RelationshipViewerContext'

const STATUSES: RelationshipStatus[] = [
    {
        key: 'case',
        label: 'Case',
        color: 'red',
        attention: true,
        size: 'large',
    },
    { key: 'contact', label: 'Contact', color: 'blue' },
]

export const te = (id: string): NodeKey => `trackedEntity:${id}`

export const graphOf = (
    records: NodeRecord[],
    seedIds: string[],
    opts: { hops?: number; fail?: string[] } = {}
): Promise<RelationshipGraph> =>
    traverse(
        seedIds.map((id) => ({ kind: 'trackedEntity' as const, id })),
        fakeFetch(records, { fail: new Set(opts.fail) }),
        { hops: opts.hops ?? 1, cap: 500, concurrency: 6 }
    )

interface Setup {
    graph?: RelationshipGraph
    status?: RelationshipViewerState['status']
    error?: unknown
    dateOf?: DateOf
    statusKey?: (node: RelationshipNode) => string
    labelOf?: (node: RelationshipNode) => string
    children: ReactNode
}

export const setup = async ({
    graph,
    status = 'ready',
    error,
    dateOf = fixtureDateOf,
    statusKey = (node) => (node.seed ? 'case' : 'contact'),
    labelOf = (node) => node.ref.id,
    children,
}: Setup) => {
    const drawn = graph ?? {
        nodes: new Map(),
        edges: new Map(),
        order: [],
        capped: false,
    }
    const orientation = orientEdges(drawn, dateOf)
    const gens = generations(drawn, orientation)
    const meta = {
        statuses: STATUSES,
        statusOf: (node: RelationshipNode) =>
            STATUSES.find((s) => s.key === statusKey(node)),
        labelOf,
        dateOf,
        orientation,
        generations: gens,
        summary: summarize(drawn, orientation, gens, statusKey, STATUSES),
        cap: 500,
    }
    const actions = {
        setLayout: vi.fn<RelationshipViewerActions['setLayout']>(),
        select: vi.fn<RelationshipViewerActions['select']>(),
        expand: vi.fn<RelationshipViewerActions['expand']>(),
        retry: vi.fn<RelationshipViewerActions['retry']>(),
    }
    const Harness = ({ meta }: { meta: RelationshipViewerMeta }) => {
        const [layout, setLayout] = useState<RelationshipViewerLayout>('web')
        const [selected, setSelected] = useState<NodeKey>()
        return (
            <RelationshipViewerProvider
                state={{ status, error, graph, layout, selected }}
                actions={{
                    ...actions,
                    select: (key) => {
                        actions.select(key)
                        setSelected(key)
                    },
                    setLayout: (next) => {
                        actions.setLayout(next)
                        setLayout(next)
                    },
                }}
                meta={meta}
            >
                {children}
            </RelationshipViewerProvider>
        )
    }
    const screen = await render(<Harness meta={meta} />)
    return {
        screen,
        actions,
        // What a host with inline rules does: equal meta, new objects.
        rebuildMeta: () =>
            screen.rerender(
                <Harness
                    meta={{ ...meta, orientation: new Map(meta.orientation) }}
                />
            ),
    }
}

export const nodeAt = (container: HTMLElement, key: NodeKey) =>
    container.querySelector(`[data-node-key="${key}"]`)!
