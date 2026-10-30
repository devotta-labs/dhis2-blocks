import { CustomDataProvider } from '@dhis2/app-runtime'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
    localDay,
    Timeline,
    TimelineEmpty,
    TimelineError,
    TimelineFeed,
    TimelineLoading,
    TimelineNotices,
    TimelineShowMore,
    TimelineTime,
    useShowMore,
    type GroupBy,
    type TimelineEntry,
    type TimelineNotice,
} from '@/components/timeline'
import {
    isEntryOf,
    TimelineEventEntry,
    TimelineEventStage,
    TimelineEventStatus,
    TimelineHistoryEntry,
    type HistoryEntryData,
} from '@/components/timeline-dhis2'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { changelogData } from './fakeChangelog'
import {
    DEFAULT_DATA,
    fakeHistory,
    historyEntries,
    type DataConfig,
    type FakeHistory,
} from './fakeHistory'

import {
    DataControls,
    DEFAULT_VIEW,
    Section,
    ViewControls,
    type ViewConfig,
} from './LabControls'

interface Config {
    data: DataConfig
    view: ViewConfig
}

type Preset = { data?: Partial<DataConfig>; view?: Partial<ViewConfig> }

const PRESETS = {
    'Case history': {},
    'Across programs': { data: { programs: 3, past: 15 } },
    'Long history': { data: { past: 120, attributeChanges: 20 } },
    "Only what's coming": {
        data: { past: 0, upcoming: 4, overdue: 0, skipped: 0 },
    },
    'Overdue pile-up': { data: { overdue: 8, upcoming: 3 } },
    'Messy data': {
        data: {
            undated: true,
            noMetadata: true,
            longText: true,
            values: 8,
            eventNotes: 'several',
            changes: 'truncated',
        },
    },
    'Values and notes': {
        data: { values: 10, eventNotes: 'several', enrollmentNotes: 5 },
    },
    'Dates only': { data: { dateOnly: true } },
    'Completed enrollment': {
        data: { enrollment: 'COMPLETED', upcoming: 0, overdue: 0 },
    },
    'Cancelled enrollment': {
        data: { enrollment: 'CANCELLED', upcoming: 0, overdue: 0, skipped: 3 },
    },
    Empty: {
        data: {
            past: 0,
            upcoming: 0,
            overdue: 0,
            skipped: 0,
            enrollment: 'none',
            attributeChanges: 0,
        },
    },
    Loading: { view: { status: 'pending' } },
    Failed: { view: { status: 'error' } },
    'Partly failed': {
        view: { errorNotice: true, warningNotice: true, infoNotice: true },
    },
    'Changes slow to load': { data: { changes: 'slow' } },
    "Changes can't load": { data: { changes: 'error' } },
    'Changes unsupported': { data: { changes: 'unsupported' } },
    'Oldest first': { view: { order: 'asc' } },
    'Phone width': { view: { width: 'phone' } },
    'Ethiopian calendar': { view: { calendar: 'ethiopian', locale: 'am' } },
    'Nepali calendar': { view: { calendar: 'nepali', locale: 'ne' } },
    'Arabic, right to left': {
        view: { calendar: 'islamic', locale: 'ar', rtl: true },
    },
} satisfies Record<string, Preset>

const WIDTHS = { phone: 'max-w-[375px]', panel: 'max-w-xl', page: 'max-w-none' }

// Kept at module level: a new function each render regroups each render.
const byMonth: GroupBy<HistoryEntryData> = (entry) => ({
    key: entry.at.slice(0, 7),
    label: entry.at.slice(0, 7),
})

const byProgram: GroupBy<HistoryEntryData> = (entry) => {
    const name =
        entry.data.kind === 'change'
            ? 'Profile'
            : (entry.data.program?.name ?? 'Unknown program')
    return { key: name, label: name }
}

const GROUP_BY = {
    day: 'day',
    none: 'none',
    month: byMonth,
    program: byProgram,
} as const

const STORAGE_KEY = 'timeline-lab'

/** The last config, so a reload keeps it; the defaults when there is none or storage is blocked. */
const savedConfig = (): Config => {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
        return {
            data: { ...DEFAULT_DATA, ...saved.data },
            view: { ...DEFAULT_VIEW, ...saved.view },
        }
    } catch {
        return { data: DEFAULT_DATA, view: DEFAULT_VIEW }
    }
}

const LabTimeline = ({
    entries,
    view,
    now,
    notices,
    act,
}: {
    entries: TimelineEntry<HistoryEntryData>[]
    view: ViewConfig
    now: Date
    notices: TimelineNotice[]
    act: (action: string) => void
}) => {
    const shown = useShowMore(entries, {
        step: view.step || entries.length || 1,
        now,
    })
    const open = (
        <button
            type="button"
            className="text-sm text-dhis2-blue-700 hover:underline"
            onClick={() => act('Open pressed')}
        >
            Open
        </button>
    )
    const render = (entry: TimelineEntry<HistoryEntryData>) => {
        if (view.renderer === 'compact' && isEntryOf(entry, 'event')) {
            return (
                <TimelineEventEntry entry={entry}>
                    <span className="flex flex-wrap items-center gap-x-2">
                        <TimelineEventStage />
                        <TimelineEventStatus />
                        <TimelineTime entry={entry} />
                    </span>
                </TimelineEventEntry>
            )
        }
        return (
            <TimelineHistoryEntry
                entry={entry}
                eventActions={view.renderer === 'actions' ? open : undefined}
            />
        )
    }
    return (
        <Timeline<HistoryEntryData>
            entries={shown.entries}
            status={view.status}
            order={view.order}
            groupBy={GROUP_BY[view.groupBy]}
            calendar={view.calendar}
            locale={view.locale}
            now={now}
            className="p-6"
        >
            <TimelineLoading />
            <TimelineError onRetry={() => act('Retry pressed')} />
            <TimelineNotices notices={notices} />
            <TimelineEmpty />
            <TimelineFeed<HistoryEntryData>>{render}</TimelineFeed>
            <TimelineShowMore
                hasMore={shown.hasMore}
                onShowMore={shown.showMore}
            />
        </Timeline>
    )
}

/** Answers "Show changes" from the fake history, with no retry wait, so failures show at once. */
const FakeServer = ({
    events,
    changes,
    children,
}: {
    events: FakeHistory['events']
    changes: DataConfig['changes']
    children: ReactNode
}) => {
    const [queryClient] = useState(
        () =>
            new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })
    )
    const data = useMemo(
        () => changelogData(events, changes),
        [events, changes]
    )
    return (
        <CustomDataProvider data={data}>
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        </CustomDataProvider>
    )
}

/** Every timeline state on a made-up person: no DHIS2 needed. */
export const TimelineLab = () => {
    const [config, setConfig] = useState(savedConfig)
    const [action, setAction] = useState<string>()
    const { data, view } = config

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
        } catch {
            // Storage blocked: the lab still works, it just forgets on reload.
        }
    }, [config])

    // Noon today: the history is laid out around it, and "now" moves from it.
    const base = useMemo(() => {
        const today = new Date()
        today.setHours(12, 0, 0, 0)
        return today
    }, [])
    const now = useMemo(
        () => new Date(base.getTime() + view.shift * 86_400_000),
        [base, view.shift]
    )
    const history = useMemo(() => fakeHistory(data, base), [data, base])
    const today = localDay(now)
    const entries = useMemo(
        () =>
            view.status === 'success'
                ? historyEntries(history, {
                      today,
                      noMetadata: data.noMetadata,
                  })
                : [],
        [history, today, data.noMetadata, view.status]
    )

    const act = (text: string) =>
        setAction(`${new Date().toLocaleTimeString()}: ${text}`)
    const notices: TimelineNotice[] = [
        ...(view.errorNotice
            ? [
                  {
                      id: 'events-failed',
                      tone: 'error' as const,
                      message: "Events from Antenatal care couldn't load.",
                      retry: () => act('Notice retry pressed'),
                  },
              ]
            : []),
        ...(view.warningNotice
            ? [
                  {
                      id: 'capped',
                      tone: 'warning' as const,
                      message: 'Showing the newest 500 events.',
                  },
              ]
            : []),
        ...(view.infoNotice
            ? [
                  {
                      id: 'unsupported',
                      tone: 'info' as const,
                      message:
                          "Profile changes aren't available on this DHIS2 version.",
                  },
              ]
            : []),
    ]
    const kinds = new Map<string, number>()
    for (const entry of entries) {
        kinds.set(entry.data.kind, (kinds.get(entry.data.kind) ?? 0) + 1)
    }
    const counts = [...kinds].map(([kind, count]) => `${count} ${kind}`)

    const setData = <K extends keyof DataConfig>(
        key: K,
        value: DataConfig[K]
    ) => setConfig({ ...config, data: { ...data, [key]: value } })
    const setView = <K extends keyof ViewConfig>(
        key: K,
        value: ViewConfig[K]
    ) => setConfig({ ...config, view: { ...view, [key]: value } })

    return (
        <div className="flex min-h-screen [font-family:Roboto,Helvetica,Arial,sans-serif] text-dhis2-grey-900">
            <aside className="sticky top-0 flex h-screen w-80 shrink-0 flex-col gap-4 overflow-y-auto border-e border-dhis2-grey-300 bg-dhis2-grey-050 p-4">
                <div className="flex items-baseline justify-between">
                    <h1 className="text-base font-medium">Timeline lab</h1>
                    <button
                        type="button"
                        className="text-sm text-dhis2-blue-700 underline"
                        onClick={() =>
                            setConfig({
                                data: DEFAULT_DATA,
                                view: DEFAULT_VIEW,
                            })
                        }
                    >
                        Reset
                    </button>
                </div>
                <Section title="Presets">
                    <div className="flex flex-wrap gap-1.5">
                        {Object.entries(PRESETS).map(
                            ([name, preset]: [string, Preset]) => (
                                <button
                                    key={name}
                                    type="button"
                                    className="rounded border border-dhis2-grey-400 bg-white px-2 py-0.5 text-sm hover:border-dhis2-blue-700"
                                    onClick={() =>
                                        setConfig({
                                            data: {
                                                ...DEFAULT_DATA,
                                                ...preset.data,
                                            },
                                            view: {
                                                ...DEFAULT_VIEW,
                                                ...preset.view,
                                            },
                                        })
                                    }
                                >
                                    {name}
                                </button>
                            )
                        )}
                    </div>
                </Section>
                <ViewControls view={view} set={setView} />
                <DataControls data={data} set={setData} />
            </aside>
            <main className="flex min-w-0 flex-1 flex-col gap-3 bg-dhis2-grey-100 p-6">
                <p className="text-sm text-dhis2-grey-700">
                    {entries.length} entries
                    {counts.length > 0 ? ` (${counts.join(', ')})` : ''} · now
                    is {today}
                    {action === undefined ? null : ` · ${action}`}
                </p>
                <div
                    dir={view.rtl ? 'rtl' : 'ltr'}
                    className={`w-full rounded border border-dhis2-grey-300 bg-white ${WIDTHS[view.width]}`}
                >
                    <FakeServer
                        // A new history starts over: shown entries, open notes and changes, fetched changes.
                        key={`${JSON.stringify(data)}:${view.step}`}
                        events={history.events}
                        changes={data.changes}
                    >
                        <LabTimeline
                            entries={entries}
                            view={view}
                            now={now}
                            notices={notices}
                            act={act}
                        />
                    </FakeServer>
                </div>
            </main>
        </div>
    )
}
