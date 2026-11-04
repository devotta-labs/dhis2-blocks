import {
    Timeline,
    TimelineEmpty,
    TimelineEnd,
    TimelineError,
    TimelineFeed,
    TimelineLoading,
    TimelineNotices,
    TimelineShowMore,
    useShowMore,
} from '@/components/timeline'
import {
    TimelineHistoryEntry,
    useSystemCalendar,
    useTrackedEntityHistory,
    type EventTimeField,
    type HistoryEntryData,
} from '@/components/timeline/dhis2'
import { useMemo, useState } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { RequestLogEntry } from '../network'
import { usePresetParam } from '../usePresetParam'
import { generateLabData, LAB_PERSON, type LabSettings } from './labData'
import { answer, labNetwork, resourcesOf } from './labServer'
import { DEFAULT_SETTINGS, PRESETS } from './presets'
import { OptionsControls } from './settings'

interface Live {
    trackedEntity: string
    /** Comma-separated program ids; empty covers every enrollment. */
    programs: string
}

interface Saved {
    mode: 'lab' | 'live'
    preset?: string
    settings: LabSettings
    live: Live
}

const STORAGE_KEY = 'timeline-lab'

/** Settings that only change props, so the history keeps its data. */
const IN_PLACE = new Set(['locale'])

const DEFAULT_SAVED: Saved = {
    mode: 'lab',
    preset: 'A few visits',
    settings: PRESETS[0]?.settings ?? DEFAULT_SETTINGS,
    // A person in the WHO RMNCH Tracker in the Sierra Leone demo database, as in the docs' case history example.
    live: { trackedEntity: 'Y8aEiTpHSSQ', programs: '' },
}

const stored = (): Saved => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return DEFAULT_SAVED
        const parsed: Partial<Saved> = JSON.parse(stored)
        return {
            ...DEFAULT_SAVED,
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
            live: { ...DEFAULT_SAVED.live, ...parsed.live },
        }
    } catch {
        return DEFAULT_SAVED
    }
}

/** The saved settings, or the linked preset's over them. */
const load = (preset?: string): Saved => {
    const saved = stored()
    const linked = PRESETS.find((each) => each.name === preset)
    return linked
        ? {
              ...saved,
              mode: 'lab',
              preset: linked.name,
              settings: linked.settings,
          }
        : saved
}

const save = (saved: Saved) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
        // Storage is a convenience; the lab works without it.
    }
}

/** The README's composition: a person's history, a step of past entries at a time. */
const History = ({
    trackedEntity,
    programs,
    timeField,
    step,
    locale,
}: {
    trackedEntity: string
    programs?: string[]
    timeField: EventTimeField
    step: number
    locale: string
}) => {
    const calendar = useSystemCalendar()
    const history = useTrackedEntityHistory({
        trackedEntity,
        programs,
        timeField,
    })
    const { entries, hasMore, showMore } = useShowMore(history.entries, {
        step,
    })
    return (
        // The block draws on a white page; the lab's canvas follows the docs' theme.
        <div
            dir={locale === 'ar' ? 'rtl' : 'ltr'}
            lang={locale}
            className="w-full max-w-2xl rounded-lg bg-white p-4 md:p-6"
        >
            <Timeline<HistoryEntryData>
                entries={entries}
                status={history.status}
                calendar={calendar}
                locale={locale}
            >
                <TimelineLoading />
                <TimelineError onRetry={history.refetch} />
                <TimelineNotices notices={history.notices} />
                <TimelineEmpty />
                <TimelineFeed<HistoryEntryData>>
                    {(entry) => <TimelineHistoryEntry entry={entry} />}
                </TimelineFeed>
                <TimelineShowMore hasMore={hasMore} onShowMore={showMore} />
                <TimelineEnd
                    hasMore={hasMore}
                    complete={history.notices.length === 0}
                />
            </Timeline>
        </div>
    )
}

/** The timeline lab: a person's history in every state, one click each, beside the requests it makes. */
export const TimelineLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [saved, setSaved] = useState(() => load(linkedPreset))
    const { mode, settings, live } = saved
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
        setLinkedPreset(merged.mode === 'lab' ? merged.preset : undefined)
    }
    const restart = () => {
        setRequests([])
        setRun((count) => count + 1)
    }
    const change = (changes: Partial<LabSettings>) => {
        update({ preset: undefined, settings: { ...settings, ...changes } })
        if (Object.keys(changes).some((key) => !IN_PLACE.has(key))) restart()
    }
    /** Options in live mode: kept apart from presets, and the history refetches by itself. */
    const changeLive = (changes: Partial<LabSettings>) => {
        update({ settings: { ...settings, ...changes } })
        if (Object.keys(changes).some((key) => !IN_PLACE.has(key))) restart()
    }

    const data = useMemo(() => generateLabData(settings), [settings])
    const respond = useMemo(() => answer(settings, data), [settings, data])
    const resources = useMemo(() => resourcesOf(data), [data])
    const network = useMemo(() => labNetwork(settings, data), [settings, data])
    const livePrograms = live.programs
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

    return (
        <LabLayout
            panel={
                mode === 'lab'
                    ? {
                          title: 'Logs',
                          children: (
                              <LogPanel
                                  requests={requests}
                                  onClearRequests={() => setRequests([])}
                              />
                          ),
                      }
                    : undefined
            }
            sidebar={
                <>
                    <Segmented
                        value={mode}
                        options={[
                            ['lab', 'Lab data'],
                            ['live', 'Live DHIS2'],
                        ]}
                        onChange={(next) => {
                            update({ mode: next })
                            restart()
                        }}
                    />
                    {mode === 'lab' ? (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={saved.preset}
                                onPick={(each) => {
                                    update({
                                        preset: each.name,
                                        settings: each.settings,
                                    })
                                    restart()
                                }}
                            />
                            <OptionsControls
                                settings={settings}
                                onChange={change}
                            />
                            <NetworkControls
                                network={settings.network}
                                records={[
                                    'tracker/trackedEntities',
                                    'tracker/events',
                                ]}
                                onChange={(next) => change({ network: next })}
                            />
                        </>
                    ) : (
                        <>
                            <Section title="Live DHIS2">
                                {(
                                    [
                                        ['trackedEntity', 'Tracked entity'],
                                        [
                                            'programs',
                                            'Programs (optional, comma-separated)',
                                        ],
                                    ] as const
                                ).map(([field, name]) => (
                                    <label
                                        key={field}
                                        className="flex flex-col gap-0.5"
                                    >
                                        {name}
                                        <input
                                            value={live[field]}
                                            onChange={(event) =>
                                                update({
                                                    live: {
                                                        ...live,
                                                        [field]:
                                                            event.target.value.trim(),
                                                    },
                                                })
                                            }
                                        />
                                    </label>
                                ))}
                            </Section>
                            <OptionsControls
                                live
                                settings={settings}
                                onChange={changeLive}
                            />
                        </>
                    )}
                    <button
                        type="button"
                        className="self-start"
                        onClick={restart}
                    >
                        Restart
                    </button>
                </>
            }
        >
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={network}
                        resources={resources}
                        respond={respond}
                        log={setRequests}
                        systemInfo={data.systemInfo}
                    >
                        <History
                            trackedEntity={LAB_PERSON}
                            timeField={settings.timeField}
                            step={settings.step}
                            locale={settings.locale}
                        />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <History
                            trackedEntity={live.trackedEntity}
                            programs={
                                livePrograms.length > 0
                                    ? livePrograms
                                    : undefined
                            }
                            timeField={settings.timeField}
                            step={settings.step}
                            locale={settings.locale}
                        />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
