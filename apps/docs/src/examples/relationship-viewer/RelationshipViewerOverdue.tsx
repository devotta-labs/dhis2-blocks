import {
    RelationshipViewer,
    RelationshipViewerCanvas,
    RelationshipViewerLegend,
    RelationshipViewerList,
    RelationshipViewerNotices,
    RelationshipViewerSummary,
    type RelationshipNode,
    type RelationshipStatus,
} from '@/components/relationship-viewer'

/**
 * A status rule of your own: a contact is overdue when their last follow-up
 * was more than 2 days before today.
 *
 * `RvE2eTei003`, the program `RvE2ePrg001` and its "Last follow-up" date
 * attribute `RvE2eAtt002` are seeded by this repository's e2e metadata.
 * Replace them with your own.
 */
const PROGRAM = 'RvE2ePrg001'
const LAST_FOLLOW_UP = 'RvE2eAtt002'
const DAY = 24 * 60 * 60 * 1000

const statuses: RelationshipStatus[] = [
    {
        key: 'case',
        label: 'Case',
        color: 'var(--color-dhis2-red-600)',
        size: 'large',
    },
    {
        key: 'overdue',
        label: 'Overdue',
        color: 'var(--color-dhis2-yellow-600)',
        attention: true,
    },
    { key: 'contact', label: 'Contact', color: 'var(--color-dhis2-blue-600)' },
]

const isOverdue = (node: RelationshipNode) => {
    if (node.state.status !== 'loaded') return false
    const value = node.state.record.attributes.find(
        (attribute) => attribute.attribute === LAST_FOLLOW_UP
    )?.value
    if (!value) return false
    const now = new Date()
    const today = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate()
    )
    // DHIS2 returns DATE values as YYYY-MM-DD, which Date.parse reads as UTC.
    return Date.parse(value) < today - 2 * DAY
}

const statusOf = (node: RelationshipNode) => {
    if (node.seed) return 'case'
    if (isOverdue(node)) return 'overdue'
    return 'contact'
}

const RelationshipViewerOverdue = () => (
    <RelationshipViewer
        seeds={{ refs: [{ kind: 'trackedEntity', id: 'RvE2eTei003' }] }}
        program={PROGRAM}
        hops={1}
        statuses={statuses}
        statusOf={statusOf}
    >
        <div className="flex flex-col gap-4">
            <RelationshipViewerSummary />
            <RelationshipViewerNotices />
            <RelationshipViewerCanvas />
            <RelationshipViewerLegend />
            <RelationshipViewerList />
        </div>
    </RelationshipViewer>
)

export default RelationshipViewerOverdue
