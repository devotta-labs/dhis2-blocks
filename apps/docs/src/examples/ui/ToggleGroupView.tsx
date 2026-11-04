import { IconCalendar16, IconTable16 } from '@dhis2/ui-icons'
import { useState } from 'react'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'

type View = 'table' | 'calendar'

/** Two ways to show the same records; one is always chosen. */
const ToggleGroupView = () => {
    const [view, setView] = useState<View>('table')

    return (
        <div className="flex flex-col gap-3">
            <ToggleGroup
                aria-label="Show records as"
                variant="outline"
                value={[view]}
                onValueChange={(next: View[]) => {
                    if (next[0]) setView(next[0])
                }}
            >
                <ToggleGroupItem value="table">
                    <IconTable16 />
                    Table
                </ToggleGroupItem>
                <ToggleGroupItem value="calendar">
                    <IconCalendar16 />
                    Calendar
                </ToggleGroupItem>
            </ToggleGroup>
            <p className="m-0 text-sm text-muted-foreground">
                Showing the records as a {view}.
            </p>
        </div>
    )
}

export default ToggleGroupView
