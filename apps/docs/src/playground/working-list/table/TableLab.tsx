import { useCallback, useContext, useMemo, useState } from 'react'
import {
    WorkingList,
    WorkingListColumnSelector,
    WorkingListFilterControls,
    WorkingListTable,
    WorkingListToolbar,
    WorkingListToolbarActions,
    WorkingListViewSwitcher,
} from '@/components/working-list'
import { LivePreviewHost } from '../../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../../controls'
import { LabLayout } from '../../LabLayout'
import { LogPanel } from '../../LogPanel'
import { CanvasBoundary, LabServerScope } from '../../LabServer'
import { NetworkControls } from '../../NetworkControls'
import type { LabNetwork, RequestLogEntry } from '../../network'
import { usePresetParam } from '../../usePresetParam'
import { DisplayChoice } from '../displayChoice'
import {
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    generateWorld,
    type LabConfig,
    type LabView,
} from './labData'
import { createLabServer, RESOURCES } from './labServer'
import { EVENT_VIEW } from './savedViews'
import { DEFAULT_CONFIG, PRESETS } from './presets'
import { OptionsControls } from './settings'

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

const STORAGE_KEY = 'working-list-lab'

const DEFAULT_SAVED: Saved = {
    mode: 'lab',
    preset: 'Clinic enrollments',
    config: DEFAULT_CONFIG,
    live: { programId: 'IpHINAT79UW', orgUnitId: 'y77LiPqLMoq' },
    width: 'full',
}

const stored = (): Saved => {
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

/** The saved settings, or the linked preset's over them. */
const load = (preset?: string): Saved => {
    const saved = stored()
    const linked = PRESETS.find((each) => each.name === preset)
    return linked
        ? { ...saved, mode: 'lab', preset: linked.name, config: linked.config }
        : saved
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
}) => (
    <WorkingList
        // The page size is a default, so a new choice remounts the list.
        key={view.pageSize}
        programId={programId}
        orgUnitId={orgUnitId}
        defaultViewId={defaultViewId}
        defaultPagination={{ page: 1, pageSize: view.pageSize }}
        onViewChange={(id) => note(`onViewChange(${JSON.stringify(id)})`)}
        onPaginationChange={(next) =>
            note(`onPaginationChange(${JSON.stringify(next)})`)
        }
    >
        {view.viewSwitcher && <WorkingListViewSwitcher />}
        {view.toolbar && (
            <WorkingListToolbar>
                {view.columnSelector && <WorkingListColumnSelector />}
                {view.filterControls && <WorkingListFilterControls />}
                {view.actions && <WorkingListToolbarActions />}
            </WorkingListToolbar>
        )}
        <WorkingListTable
            dataQualityMode={view.dataQuality}
            onRowClick={
                view.clickable
                    ? (target) => note(`onRowClick(${JSON.stringify(target)})`)
                    : undefined
            }
        />
    </WorkingList>
)

/** The working list as a table: the table and its toolbar on generated data, beside the requests it makes. */
export const TableLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const displayChoice = useContext(DisplayChoice)
    const [saved, setSaved] = useState(() => load(linkedPreset))
    const { mode, config, live, width } = saved
    const [run, setRun] = useState(0)
    const [requests, setRequests] = useState<RequestLogEntry[]>([])
    const [callbacks, setCallbacks] = useState<string[]>([])

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
    // Network changes need a fresh list; props apply in place.
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

    const { data, server } = config
    const world = useMemo(() => generateWorld(data), [data])
    // A fresh server each run, so views saved in one run are gone in the next.
    const respond = useMemo(
        () => createLabServer({ data, server }, world),
        [data, server, world, run]
    )
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'

    return (
        <LabLayout
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
                    {displayChoice}
                    {mode === 'lab' ? (
                        <PresetControls
                            presets={PRESETS}
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
                    ) : (
                        <Section title="Live DHIS2">
                            {(
                                [
                                    ['programId', 'Program'],
                                    ['orgUnitId', 'Organisation unit'],
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
                    )}
                    <OptionsControls view={config.view} onChange={setView} />
                    {mode === 'lab' && (
                        <NetworkControls
                            network={config.network}
                            records={[
                                'tracker/trackedEntities',
                                'tracker/events',
                            ]}
                            onChange={setNetwork}
                        />
                    )}
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
                            apiVersion={server.apiVersion}
                            resources={RESOURCES}
                            respond={respond}
                            log={setRequests}
                        >
                            <LabComposition
                                view={config.view}
                                programId={LAB_PROGRAM}
                                orgUnitId={LAB_ORG_UNIT}
                                defaultViewId={
                                    data.mode === 'event'
                                        ? EVENT_VIEW
                                        : undefined
                                }
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
