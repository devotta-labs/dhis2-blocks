import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SpreadsheetGrid } from '@/components/spreadsheet'
import {
    TrackerDataEntry,
    TrackerDataEntrySummary,
    eventSource,
    useTrackerDataEntry,
} from '@/components/tracker-data-entry'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
})

const params = new URLSearchParams(window.location.search)
const programId = params.get('program') ?? ''
const orgUnitId = params.get('orgUnit') ?? ''
const pageSize = Number(params.get('pageSize') ?? 50)

// Made once: a source with new keys loads the form again.
const source =
    programId === '' || orgUnitId === ''
        ? undefined
        : eventSource({ programId, orgUnitId, pageSize })

const Status = () => {
    const status = useTrackerDataEntry((view) => view.status)
    const error = useTrackerDataEntry((view) => view.error)
    return status === 'ready' ? null : (
        <p role="status">
            {status === 'loading'
                ? 'Loading…'
                : `The form could not be loaded: ${error}`}
        </p>
    )
}

const SourceForm = () => (
    <form className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
            Program
            <input
                name="program"
                defaultValue={programId}
                className="rounded border border-dhis2-input px-2 py-1"
            />
        </label>
        <label className="flex flex-col gap-1">
            Organisation unit
            <input
                name="orgUnit"
                defaultValue={orgUnitId}
                className="rounded border border-dhis2-input px-2 py-1"
            />
        </label>
        <label className="flex flex-col gap-1">
            Rows per page
            <input
                name="pageSize"
                type="number"
                min={1}
                defaultValue={pageSize}
                className="w-24 rounded border border-dhis2-input px-2 py-1"
            />
        </label>
        <button
            type="submit"
            className="rounded border border-dhis2-input px-3 py-1"
        >
            Open
        </button>
    </form>
)

const App = () => (
    <QueryClientProvider client={queryClient}>
        <main className="flex flex-col gap-4 p-4">
            <SourceForm />
            {source === undefined ? (
                <p>
                    Name a program and an organisation unit to open its events.
                </p>
            ) : (
                <TrackerDataEntry source={source}>
                    <Status />
                    <SpreadsheetGrid />
                    <TrackerDataEntrySummary />
                </TrackerDataEntry>
            )}
        </main>
    </QueryClientProvider>
)

export default App
