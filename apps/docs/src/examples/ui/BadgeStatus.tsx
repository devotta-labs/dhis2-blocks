import { Badge } from '@/components/dhis2/ui/badge'

// SAFETY: colour-literal: the metadata legend pairs this fill with AA-contrast text.
const legendStyle = { backgroundColor: '#ffcdd2', color: '#891515' }

/** Statuses as small pills, one coloured from a legend. */
const BadgeStatus = () => (
    <div className="flex flex-wrap items-center gap-2">
        <Badge>Active</Badge>
        <Badge variant="secondary">Completed</Badge>
        <Badge variant="outline">Cancelled</Badge>
        <Badge style={legendStyle}>High risk</Badge>
    </div>
)

export default BadgeStatus
