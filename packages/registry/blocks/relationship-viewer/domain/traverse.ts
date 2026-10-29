import {
    nodeKey,
    type FetchRecord,
    type NodeKey,
    type NodeRef,
    type NodeState,
    type RelationshipEdge,
    type RelationshipGraph,
    type RelationshipLink,
    type RelationshipNode,
} from './model'

export interface TraversalOptions {
    hops: number
    cap: number
    concurrency: number
    followTypes?: ReadonlySet<string> // undefined = follow all
    expanded?: ReadonlySet<NodeKey> // nodes whose neighbours are drawn regardless of hops
}

interface Drawn {
    ref: NodeRef
    hop: number
    seed: boolean
    discoveredVia?: string
    state?: NodeState
    followed: { link: RelationshipLink; far: NodeKey }[]
    otherLinkCount: number
}

/** Runs `fn` over `items` with at most `limit` in flight; results keep input order. */
const pool = async <T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T) => Promise<R>
): Promise<R[]> => {
    const results: R[] = []
    let next = 0
    const worker = async (): Promise<void> => {
        while (next < items.length) {
            const i = next++
            results[i] = await fn(items[i])
        }
    }
    await Promise.all(
        Array.from(
            { length: Math.min(Math.max(1, limit), items.length) },
            worker
        )
    )
    return results
}

const settle = (fetchRecord: FetchRecord, ref: NodeRef): Promise<NodeState> =>
    fetchRecord(ref).then(
        (record): NodeState => ({ status: 'loaded', record }),
        (error): NodeState => ({ status: 'failed', error })
    )

export async function traverse(
    seeds: readonly NodeRef[],
    fetchRecord: FetchRecord,
    { hops, cap, concurrency, followTypes, expanded }: TraversalOptions
): Promise<RelationshipGraph> {
    const drawn = new Map<NodeKey, Drawn>()
    let capped = false

    const draw = (
        ref: NodeRef,
        hop: number,
        seed: boolean,
        discoveredVia?: string
    ): Drawn | undefined => {
        if (drawn.size >= cap) {
            capped = true
            return undefined
        }
        const node: Drawn = {
            ref,
            hop,
            seed,
            discoveredVia,
            followed: [],
            otherLinkCount: 0,
        }
        drawn.set(nodeKey(ref), node)
        return node
    }

    let level: Drawn[] = []
    for (const ref of seeds) {
        if (!drawn.has(nodeKey(ref))) {
            const node = draw(ref, 0, true)
            if (node) level.push(node)
        }
    }

    while (level.length > 0) {
        const states = await pool(level, concurrency, (n) =>
            settle(fetchRecord, n.ref)
        )
        const next: Drawn[] = []
        level.forEach((node, i) => {
            const state = states[i]
            node.state = state
            if (state.status !== 'loaded') return
            node.otherLinkCount += state.record.unresolvedLinkCount ?? 0
            const self = nodeKey(node.ref)
            const explore = node.hop < hops || !!expanded?.has(self)
            for (const link of state.record.relationships) {
                const from = nodeKey(link.from)
                const to = nodeKey(link.to)
                if (from === to) continue
                if (followTypes && !followTypes.has(link.relationshipType)) {
                    node.otherLinkCount++
                    continue
                }
                const far = from === self ? to : from
                node.followed.push({ link, far })
                if (explore && !drawn.has(far)) {
                    const farRef = from === self ? link.to : link.from
                    const child = draw(
                        farRef,
                        node.hop + 1,
                        false,
                        link.relationship
                    )
                    if (child) next.push(child)
                }
            }
        })
        level = next
    }

    const nodes = new Map<NodeKey, RelationshipNode>()
    const edges = new Map<string, RelationshipEdge>()
    for (const [key, d] of drawn) {
        const unseen = d.followed.filter((f) => !drawn.has(f.far))
        for (const { link } of d.followed) {
            if (edges.has(link.relationship)) continue
            if (
                !drawn.has(nodeKey(link.from)) ||
                !drawn.has(nodeKey(link.to))
            ) {
                continue
            }
            edges.set(link.relationship, {
                id: link.relationship,
                type: link.relationshipType,
                bidirectional: link.bidirectional,
                ...(link.createdAt && { createdAt: link.createdAt }),
                from: nodeKey(link.from),
                to: nodeKey(link.to),
            })
        }
        nodes.set(key, {
            key,
            ref: d.ref,
            hop: d.hop,
            seed: d.seed,
            // SAFETY: every drawn node is fetched before the loop above exits.
            state: d.state as NodeState,
            stubCount: unseen.length,
            otherLinkCount: d.otherLinkCount,
            ...(d.discoveredVia && { discoveredVia: d.discoveredVia }),
        })
    }

    return { nodes, edges, order: [...drawn.keys()], capped }
}
