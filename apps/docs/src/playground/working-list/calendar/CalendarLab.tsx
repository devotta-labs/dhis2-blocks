import {
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useState,
    type ReactNode,
} from 'react'
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
import { LivePreviewHost } from '../../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../../preview/PreviewShell'
import { LabLayout } from '../../LabLayout'
import { LogPanel } from '../../LogPanel'
import { CanvasBoundary, LabServerScope } from '../../LabServer'
import { NetworkControls } from '../../NetworkControls'
import type { Log } from '../../network'
import { usePresetParam } from '../../usePresetParam'
import { DisplayChoice } from '../displayChoice'
import { PresetControls, Section, Segmented } from '../../controls'
import {
    LAB_ORG_UNIT,
    LAB_PROGRAM,
    generateWorld,
    recordLabelFor,
    recordStatusFor,
    weekendFor,
    type LabConfig,
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
import { PlainCount } from './panels'
import { initialLabState, labReducer, type Width } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['desktop', 'Desktop', 'max-w-[1100px]'],
    ['full', 'Full', 'max-w-none'],
]

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
    if (view.layout === 'both') {
        body = (
            <div className="grid gap-2 xl:grid-cols-2">
                {table}
                {calendar}
            </div>
        )
    }
    if (view.layout === 'toggle') body = toggle === 'table' ? table : calendar
    // Columns are the table's; a calendar has none to choose.
    const showsTable =
        view.layout === 'both' ||
        (view.layout === 'toggle' && toggle === 'table')

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
                    {showsTable && <WorkingListColumnSelector />}
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
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const displayChoice = useContext(DisplayChoice)
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, config, live, width, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    // Stable, so neither the lab server nor the list is rebuilt for each entry.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const note = useCallback(
        (entry: string) =>
            dispatch({
                type: 'noteCallback',
                entry: `${new Date().toLocaleTimeString()} ${entry}`,
            }),
        []
    )

    const world = useMemo(() => generateWorld(config.data), [config.data])
    const respond = useCallback(
        (request: LabRequest) => answer(config, world, request),
        [config, world]
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
                        onClearCallbacks={() =>
                            dispatch({ type: 'clearCallbacks' })
                        }
                        onClearRequests={() =>
                            dispatch({ type: 'clearRequests' })
                        }
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
                        onChange={(next) =>
                            dispatch({ type: 'switchMode', mode: next })
                        }
                    />
                    {displayChoice}
                    {mode === 'lab' ? (
                        <PresetControls
                            presets={PRESETS}
                            selected={state.preset}
                            onPick={(preset) =>
                                dispatch({ type: 'pickPreset', preset })
                            }
                        />
                    ) : (
                        <Section title="Live DHIS2">
                            <label className="flex flex-col gap-0.5">
                                Program
                                <input
                                    value={live.programId}
                                    onChange={(event) =>
                                        dispatch({
                                            type: 'changeLive',
                                            changes: {
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
                                        dispatch({
                                            type: 'changeLive',
                                            changes: {
                                                orgUnitId:
                                                    event.target.value.trim(),
                                            },
                                        })
                                    }
                                />
                            </label>
                        </Section>
                    )}
                    <OptionsControls
                        server={mode === 'lab' ? config.server : undefined}
                        view={config.view}
                        onServerChange={(server) =>
                            dispatch({ type: 'changeServer', server })
                        }
                        onViewChange={(view) =>
                            dispatch({ type: 'changeView', view })
                        }
                    />
                    {mode === 'lab' && (
                        <NetworkControls
                            network={config.network}
                            records={[
                                'tracker/trackedEntities',
                                'tracker/events',
                            ]}
                            onChange={(network) =>
                                dispatch({ type: 'changeNetwork', network })
                            }
                        />
                    )}
                    <Section title="Canvas">
                        <Segmented
                            value={width}
                            options={WIDTHS.map(([option, name]) => [
                                option,
                                name,
                            ])}
                            onChange={(next) =>
                                dispatch({ type: 'changeWidth', width: next })
                            }
                        />
                        <button
                            type="button"
                            className="self-start"
                            onClick={() => dispatch({ type: 'restart' })}
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
                            log={log}
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
