import { useCallback, useMemo, useState, type ReactNode } from 'react'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import {
    WorkingListCalendar,
    WorkingListCalendarCellRecords,
    WorkingListCalendarDayRecords,
    WorkingListCalendarDisplayToggle,
    WorkingListCalendarGrid,
    WorkingListCalendarNavigation,
} from '@/components/working-list-calendar'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { LabLayout } from '../LabLayout'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { LabNetwork, RequestLogEntry } from '../network'
import { Section, Segmented } from './controls'
import {
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    generateWorld,
    recordLabelFor,
    recordStatusFor,
    weekendFor,
    type LabConfig,
    type LabData,
    type LabServer,
    type LabView,
} from './labData'
import {
    EVENT_SAVED_VIEW,
    RESOURCES,
    TE_SAVED_VIEW,
    answer,
    hasTrackedEntityView,
    type LabRequest,
} from './labServer'
import { CalendarReadout, LogPanel, PlainCount } from './panels'
import { DEFAULT_CONFIG, PRESETS } from './presets'
import {
    DataControls,
    PresetControls,
    ServerControls,
    ViewControls,
} from './settings'

type Width = 'phone' | 'tablet' | 'desktop' | 'full'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['desktop', 'Desktop', 'max-w-[1100px]'],
    ['full', 'Full', 'max-w-none'],
]

interface Saved {
    mode: 'lab' | 'live'
    preset?: string
    config: LabConfig
    live: { programId: string; orgUnitId: string }
    width: Width
}

const STORAGE_KEY = 'working-list-calendar-lab'

const DEFAULT_SAVED: Saved = {
    mode: 'lab',
    preset: 'Clinic enrollments',
    config: DEFAULT_CONFIG,
    live: { programId: 'IpHINAT79UW', orgUnitId: 'y77LiPqLMoq' },
    width: 'desktop',
}

const load = (): Saved => {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)
        if (!stored) return DEFAULT_SAVED
        const parsed: Partial<Saved> = JSON.parse(stored)
        return {
            ...DEFAULT_SAVED,
            ...parsed,
            config: {
                data: { ...DEFAULT_CONFIG.data, ...parsed.config?.data },
                server: { ...DEFAULT_CONFIG.server, ...parsed.config?.server },
                network: {
                    ...DEFAULT_CONFIG.network,
                    ...parsed.config?.network,
                },
                view: { ...DEFAULT_CONFIG.view, ...parsed.config?.view },
            },
        }
    } catch {
        return DEFAULT_SAVED
    }
}

const save = (saved: Saved) => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))
    } catch {
        // Storage is a convenience; the lab works without it.
    }
}

const LabComposition = ({
    view,
    programId,
    orgUnitId,
    defaultViewId,
    note,
}: {
    view: LabView
    programId: string
    orgUnitId: string
    defaultViewId?: string
    note: (entry: string) => void
}) => {
    const [selectedDay, setSelectedDay] = useState<string | null>(null)
    const [toggle, setToggle] = useState<'table' | 'calendar'>('calendar')
    const onSelectedDayChange = (day: string | null) => {
        note(`onSelectedDayChange(${day === null ? 'null' : `'${day}'`})`)
        setSelectedDay(day)
    }
    const dayProps = view.controlledDay
        ? { selectedDay, onSelectedDayChange }
        : { onSelectedDayChange }

    const calendar = (
        <WorkingListCalendar
            // The display is a default, so a new choice remounts the calendar.
            key={view.display}
            className="p-2"
            defaultDisplay={view.display}
            onDisplayChange={(display) => note(`onDisplayChange('${display}')`)}
            recordStatus={recordStatusFor(view)}
            dateField={
                view.dateField === 'default' ? undefined : view.dateField
            }
            limit={view.limit}
            recordLabel={recordLabelFor(view)}
            onRecordClick={
                view.clickable
                    ? (target) =>
                          note(`onRecordClick(${JSON.stringify(target)})`)
                    : undefined
            }
            {...dayProps}
        >
            {view.navigation && (
                <div className="flex flex-wrap items-center gap-2">
                    <WorkingListCalendarNavigation />
                    {view.displayToggle && (
                        <WorkingListCalendarDisplayToggle className="ms-auto" />
                    )}
                </div>
            )}
            {view.grid && (
                <WorkingListCalendarGrid
                    weekend={weekendFor(view)}
                    weekendColumns={view.weekendColumns}
                >
                    {view.cell === 'records' && (
                        <WorkingListCalendarCellRecords max={view.perDay} />
                    )}
                    {view.cell === 'plainCount' && <PlainCount />}
                </WorkingListCalendarGrid>
            )}
            {view.dayRecords && <WorkingListCalendarDayRecords />}
            {view.readout && <CalendarReadout />}
        </WorkingListCalendar>
    )
    const table = (
        <WorkingListTable
            onRowClick={(target) =>
                note(`onRowClick(${JSON.stringify(target)})`)
            }
        />
    )

    let body: ReactNode = calendar
    if (view.layout === 'table') body = table
    if (view.layout === 'both') {
        body = (
            <div className="grid gap-2 xl:grid-cols-2">
                {table}
                {calendar}
            </div>
        )
    }
    if (view.layout === 'toggle') body = toggle === 'table' ? table : calendar

    return (
        <WorkingList
            programId={programId}
            orgUnitId={orgUnitId}
            defaultViewId={defaultViewId}
            onViewChange={(id) => note(`onViewChange(${JSON.stringify(id)})`)}
        >
            {view.toolbar && <WorkingListViewSwitcher />}
            {view.toolbar && (
                <WorkingListToolbar>
                    <WorkingListColumnSelector />
                    <WorkingListFilterControls />
                    {view.layout === 'toggle' && (
                        <ToggleGroup
                            aria-label="Layout"
                            variant="outline"
                            size="sm"
                            className="ms-auto"
                            value={[toggle]}
                        >
                            <ToggleGroupItem
                                value="table"
                                onClick={() => setToggle('table')}
                            >
                                Table
                            </ToggleGroupItem>
                            <ToggleGroupItem
                                value="calendar"
                                onClick={() => setToggle('calendar')}
                            >
                                Calendar
                            </ToggleGroupItem>
                        </ToggleGroup>
                    )}
                </WorkingListToolbar>
            )}
            {body}
        </WorkingList>
    )
}

const defaultViewFor = (config: LabConfig) => {
    if (config.data.mode === 'event') return EVENT_SAVED_VIEW
    return hasTrackedEntityView(config) ? TE_SAVED_VIEW : undefined
}

/** The working list calendar lab: every prop, part and kind of data, beside the requests it makes. */
export const CalendarLab = () => {
    const [saved, setSaved] = useState(load)
    const { mode, config, live, width } = saved
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])
    const [callbacks, setCallbacks] = useState<string[]>([])

    const update = (next: Partial<Saved>) => {
        const merged = { ...saved, ...next }
        setSaved(merged)
        save(merged)
    }
    const restart = () => {
        setRequests([])
        setRun((count) => count + 1)
    }
    // Data and server changes need a fresh list; props apply in place.
    const setData = (data: LabData) => {
        update({ preset: undefined, config: { ...config, data } })
        restart()
    }
    const setServer = (server: LabServer) => {
        update({ preset: undefined, config: { ...config, server } })
        restart()
    }
    const setNetwork = (network: LabNetwork) => {
        update({ preset: undefined, config: { ...config, network } })
        restart()
    }
    const setView = (view: LabView) =>
        update({ preset: undefined, config: { ...config, view } })
    const note = useCallback(
        (entry: string) =>
            setCallbacks((entries) =>
                [
                    `${new Date().toLocaleTimeString()} ${entry}`,
                    ...entries,
                ].slice(0, 80)
            ),
        []
    )

    const world = useMemo(() => generateWorld(config.data), [config.data])
    const respond = useCallback(
        (request: LabRequest) => answer(config, world, request),
        [config, world]
    )
    const activePreset = PRESETS.find((each) => each.name === saved.preset)
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'

    return (
        <LabLayout
            title="Working list calendar lab"
            status={
                mode === 'lab' ? (
                    <span className="truncate">
                        {activePreset?.name.toUpperCase() ?? 'CUSTOM'}
                    </span>
                ) : (
                    <span className="truncate">
                        LIVE · {live.programId} / {live.orgUnitId}
                    </span>
                )
            }
            panel={{
                title: 'Logs',
                children: (
                    <LogPanel
                        callbacks={callbacks}
                        requests={mode === 'lab' ? requests : undefined}
                        onClearCallbacks={() => setCallbacks([])}
                        onClearRequests={() => setRequests([])}
                    />
                ),
            }}
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
                                selected={saved.preset}
                                onPick={(each) => {
                                    update({
                                        preset: each.name,
                                        config: each.config,
                                    })
                                    setCallbacks([])
                                    restart()
                                }}
                            />
                            <DataControls
                                data={config.data}
                                onChange={setData}
                            />
                            <ServerControls
                                server={config.server}
                                onChange={setServer}
                            />
                            <Section title="Network">
                                <NetworkControls
                                    network={config.network}
                                    endpoints={RESOURCES}
                                    onChange={setNetwork}
                                />
                            </Section>
                        </>
                    ) : (
                        <Section title="Live DHIS2">
                            <label className="flex flex-col gap-0.5">
                                Program
                                <input
                                    value={live.programId}
                                    onChange={(event) =>
                                        update({
                                            live: {
                                                ...live,
                                                programId:
                                                    event.target.value.trim(),
                                            },
                                        })
                                    }
                                />
                            </label>
                            <label className="flex flex-col gap-0.5">
                                Organisation unit
                                <input
                                    value={live.orgUnitId}
                                    onChange={(event) =>
                                        update({
                                            live: {
                                                ...live,
                                                orgUnitId:
                                                    event.target.value.trim(),
                                            },
                                        })
                                    }
                                />
                            </label>
                        </Section>
                    )}
                    <ViewControls view={config.view} onChange={setView} />
                    <Section title="Canvas">
                        <Segmented
                            value={width}
                            options={WIDTHS.map(([option, name]) => [
                                option,
                                name,
                            ])}
                            onChange={(next) => update({ width: next })}
                        />
                        <button
                            type="button"
                            className="self-start"
                            onClick={restart}
                        >
                            Restart
                        </button>
                    </Section>
                </>
            }
        >
            <div className={`w-full ${widthClass} bg-white`}>
                <CanvasBoundary key={run}>
                    {mode === 'lab' ? (
                        <LabServerScope
                            key={run}
                            network={config.network}
                            apiVersion={config.server.apiVersion}
                            resources={RESOURCES}
                            respond={respond}
                            log={setRequests}
                        >
                            <LabComposition
                                view={config.view}
                                programId={LAB_PROGRAM}
                                orgUnitId={LAB_ORG_UNIT}
                                defaultViewId={defaultViewFor(config)}
                                note={note}
                            />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <LabComposition
                                key={`${live.programId}/${live.orgUnitId}`}
                                view={config.view}
                                programId={live.programId}
                                orgUnitId={live.orgUnitId}
                                note={note}
                            />
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
