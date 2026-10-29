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
 * Every person enrolled in a program at one organisation unit, and the links
 * between them, on a timeline.
 *
 * The seed query is passed to `/api/tracker/trackedEntities` and must name its
 * program. `RvE2ePrg001` is seeded by this repository's e2e metadata at the
 * organisation unit `DiszpKrYNg8`; replace both with your own.
 */
const PROGRAM = 'RvE2ePrg001'

const statuses: RelationshipStatus[] = [
    {
        key: 'followUp',
        label: 'Marked for follow-up',
        color: 'var(--color-dhis2-yellow-600)',
        attention: true,
    },
    { key: 'person', label: 'Person', color: 'var(--color-dhis2-blue-600)' },
    { key: 'visit', label: 'Visit', color: 'var(--color-dhis2-green-600)' },
]

const statusOf = (node: RelationshipNode) => {
    if (node.ref.kind === 'event') return 'visit'
    if (isMarkedForFollowUp(node, PROGRAM)) return 'followUp'
    return 'person'
}

const RelationshipViewerOutbreak = () => {
    const [layout, setLayout] = useState<RelationshipViewerLayout>('timeline')

    return (
        <RelationshipViewer
            seeds={{ query: { program: PROGRAM, orgUnits: 'DiszpKrYNg8' } }}
            hops={2}
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

export default RelationshipViewerOutbreak
