import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    eventSource,
    registerSource,
    useTrackerDataEntry,
    type EventSourceOptions,
    type RegisterSourceOptions,
} from '@/components/tracker-data-entry'
import { useMemo } from 'react'

interface Props {
    /** An event grid's options, or a register's (with its `layout`). */
    options: EventSourceOptions | RegisterSourceOptions
}

// Replace with your app's loading and error states.
const Status = () => {
    const status = useTrackerDataEntry((view) => view.status)
    const error = useTrackerDataEntry((view) => view.error)
    return status === 'ready' ? null : (
        <p role="status" className="text-sm text-dhis2-grey-700">
            {status === 'loading'
                ? 'Loading…'
                : `The form could not be loaded: ${error}`}
        </p>
    )
}

/** The README's composition: the grid and its summary over one source. */
export const TrackerDataEntryCanvas = ({ options }: Props) => {
    // Made once per options: a source with new keys loads the form again.
    const source = useMemo(
        () =>
            'layout' in options
                ? registerSource(options)
                : eventSource(options),
        [options]
    )
    return (
        // The block draws on a white page; the lab's canvas follows the docs' theme.
        <div className="w-full min-w-0 rounded-lg bg-white p-4">
            <TrackerDataEntry source={source}>
                <Status />
                <SpreadsheetGrid />
                <TrackerDataEntrySummary />
            </TrackerDataEntry>
        </div>
    )
}
