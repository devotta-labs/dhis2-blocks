import { Badge } from '@/components/dhis2/ui/badge'

/** Statuses as small pills, one coloured from a legend. */
const BadgeStatus = () => (
    <div className="flex flex-wrap items-center gap-2">
        <Badge>Active</Badge>
        <Badge variant="secondary">Completed</Badge>
        <Badge variant="outline">Cancelled</Badge>
        {/* colour-literal: a fill and text pair from a metadata legend */}
        <Badge style={{ backgroundColor: '#ffcdd2', color: '#891515' }}>
            High risk
        </Badge>
    </div>
)

export default BadgeStatus
