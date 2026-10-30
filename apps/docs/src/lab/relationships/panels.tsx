import {
    useRelationshipViewerMeta,
    useRelationshipViewerState,
    type RelationshipNode,
} from '@/components/relationship-viewer'
import type { ReactNode } from 'react'
import type { LabRequest, RequestLogEntry } from './labServer'

/** What a host receives for the selection, and the re-centre a host would offer. */
export const HostPanel = ({
    onRecentre,
}: {
    onRecentre: (node: RelationshipNode) => void
}) => {
    const { graph, selected } = useRelationshipViewerState()
    const { labelOf, statusOf, generations } = useRelationshipViewerMeta()
    const node = selected && graph?.nodes.get(selected)
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">Selected record</h2>
            {node ? (
                <>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
                        {(
                            [
                                ['Label', labelOf(node)],
                                ['Key', node.key],
                                [
                                    'Status',
                                    (node.state.status === 'loaded' &&
                                        statusOf(node)?.label) ||
                                        node.state.status,
                                ],
                                ['Hop', node.hop],
                                [
                                    'Generation',
                                    generations.get(node.key) ?? '–',
                                ],
                                ['Seed', node.seed ? 'yes' : 'no'],
                                ['Unloaded links', node.stubCount],
                                ['Other links', node.otherLinkCount],
                            ] as const
                        ).map(([term, value]) => (
                            <div key={term} className="contents">
                                <dt className="text-dhis2-grey-700">{term}</dt>
                                <dd className="break-all">{value}</dd>
                            </div>
                        ))}
                    </dl>
                    {node.ref.kind === 'trackedEntity' && (
                        <button
                            type="button"
                            className="self-start rounded border border-dhis2-grey-500 px-2 py-0.5 text-sm"
                            onClick={() => onRecentre(node)}
                        >
                            Re-centre here
                        </button>
                    )}
                </>
            ) : (
                <p className="text-sm text-dhis2-grey-700">
                    Select a record in the canvas or the list.
                </p>
            )}
        </section>
    )
}

/** The provider's state at a glance, to see what each control changes. */
export const StateReadout = () => {
    const { status, fetching, graph, layout } = useRelationshipViewerState()
    const { summary } = useRelationshipViewerMeta()
    const rows: [string, string | number][] = [
        ['Status', `${status}${fetching ? ', fetching' : ''}`],
        ['Layout', layout],
        ['Nodes', graph?.nodes.size ?? 0],
        ['Edges', graph?.edges.size ?? 0],
        ['Capped', graph?.capped ? 'yes' : 'no'],
        ['Unloaded links', summary.unloadedLinkCount],
        ['On records', summary.unloadedNodeCount],
        ['Generations', summary.generationCount],
        ['Clusters', summary.clusterCount],
    ]
    return (
        <section className="flex flex-col gap-2">
            <h2 className="text-sm font-medium">State</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[11px]">
                {rows.map(([term, value]) => (
                    <div key={term} className="contents">
                        <dt className="text-dhis2-grey-700">{term}</dt>
                        <dd>{value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

const outcomeClass = {
    pending: 'text-dhis2-grey-700',
    ok: 'text-dhis2-green-800',
    failed: 'text-dhis2-red-700',
} satisfies Record<RequestLogEntry['outcome'], string>

const Panel = ({
    title,
    onClear,
    children,
}: {
    title: string
    onClear: () => void
    children: ReactNode
}) => (
    <section className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium">{title}</h2>
            <button
                type="button"
                className="text-sm text-dhis2-blue-700 underline"
                onClick={onClear}
            >
                Clear
            </button>
        </div>
        {children}
    </section>
)

const describeRequest = ({ resource, id, params = {} }: LabRequest) => {
    const of = params.trackedEntity ?? params.event
    if (id) return `${resource}/${id}${params.program ? ' (program)' : ''}`
    if (of)
        return `${resource}?${params.trackedEntity ? 'trackedEntity' : 'event'}=${String(of)}`
    if (params.page) return `${resource} page ${String(params.page)}`
    return resource
}

export const RequestLog = ({
    entries,
    onClear,
}: {
    entries: RequestLogEntry[]
    onClear: () => void
}) => (
    <Panel title={`Requests (${entries.length})`} onClear={onClear}>
        {entries.length === 0 ? (
            <p className="text-sm text-dhis2-grey-700">No requests yet.</p>
        ) : (
            <ol className="flex flex-col gap-1 font-mono text-[11px] leading-4">
                {entries.map((entry) => (
                    <li
                        key={entry.id}
                        className="rounded bg-dhis2-grey-100 p-1.5"
                    >
                        <div className="flex justify-between gap-2">
                            <span className="break-all">
                                {describeRequest(entry.request)}
                            </span>
                            <span className={outcomeClass[entry.outcome]}>
                                {entry.outcome}
                                {entry.ms === undefined ? '' : ` ${entry.ms}ms`}
                            </span>
                        </div>
                        {entry.detail ? (
                            <div className="break-all text-dhis2-red-700">
                                {entry.detail}
                            </div>
                        ) : null}
                    </li>
                ))}
            </ol>
        )}
    </Panel>
)

export const Changes = ({
    entries,
    onClear,
}: {
    entries: string[]
    onClear: () => void
}) => (
    <Panel title="Callbacks" onClear={onClear}>
        {entries.length === 0 ? (
            <p className="text-sm text-dhis2-grey-700">
                No onSelectedChange or onLayoutChange yet.
            </p>
        ) : (
            <ol className="flex flex-col gap-0.5 font-mono text-[11px]">
                {entries.map((entry, index) => (
                    <li key={entries.length - index}>{entry}</li>
                ))}
            </ol>
        )}
    </Panel>
)
