import {
    RelationshipViewer,
    RelationshipViewerCanvas,
    RelationshipViewerLayoutToggle,
    RelationshipViewerLegend,
    RelationshipViewerList,
    RelationshipViewerNotices,
    RelationshipViewerSummary,
    isMarkedForFollowUp,
    type RelationshipNode,
    type RelationshipStatus,
    type RelationshipViewerLayout,
} from '@/components/relationship-viewer'
import { useState } from 'react'

/**
 * One case and everyone linked to it, opening on the trace.
 *
 * `RvE2eTei010` and the "Contact tracing" program `RvE2ePrg001` are seeded by
 * this repository's e2e metadata. Replace them with a tracked entity and
 * program from your own instance.
 */
const PROGRAM = 'RvE2ePrg001'

// Declared outside the component so they keep their identity across renders.
const statuses: RelationshipStatus[] = [
    {
        key: 'case',
        label: 'Case',
        color: 'var(--color-dhis2-red-600)',
        size: 'large',
    },
    {
        key: 'followUp',
        label: 'Marked for follow-up',
        color: 'var(--color-dhis2-yellow-600)',
        attention: true,
    },
    { key: 'contact', label: 'Contact', color: 'var(--color-dhis2-blue-600)' },
]

const statusOf = (node: RelationshipNode) => {
    if (node.seed) return 'case'
    if (isMarkedForFollowUp(node, PROGRAM)) return 'followUp'
    return 'contact'
}

const RelationshipViewerFromCase = () => {
    const [layout, setLayout] = useState<RelationshipViewerLayout>('trace')

    return (
        <RelationshipViewer
            seeds={{ refs: [{ kind: 'trackedEntity', id: 'RvE2eTei010' }] }}
            program={PROGRAM}
            hops={1}
            statuses={statuses}
            statusOf={statusOf}
            layout={layout}
            onLayoutChange={setLayout}
        >
            <div className="flex flex-col gap-4">
                <RelationshipViewerLayoutToggle />
                <RelationshipViewerSummary />
                <RelationshipViewerNotices />
                <RelationshipViewerCanvas />
                <RelationshipViewerLegend />
                <RelationshipViewerList />
            </div>
        </RelationshipViewer>
    )
}

export default RelationshipViewerFromCase
