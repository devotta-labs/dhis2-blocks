import { useCallback, useContext, useEffect, useMemo, useReducer } from 'react'
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
    type LabConfig,
} from './labData'
import {
    EVENT_SAVED_VIEW,
    RESOURCES,
    TE_SAVED_VIEW,
    answer,
    hasTrackedEntityView,
    type LabRequest,
} from './labServer'
import { initialLabState, labReducer, type Width } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { CalendarCanvas } from './CalendarCanvas'
import canvasSource from './CalendarCanvas.tsx?canvas'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['desktop', 'Desktop', 'max-w-[1100px]'],
    ['full', 'Full', 'max-w-none'],
]

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

    const canvasProps = {
        view: config.view,
        programId: mode === 'lab' ? LAB_PROGRAM : live.programId,
        orgUnitId: mode === 'lab' ? LAB_ORG_UNIT : live.orgUnitId,
        defaultViewId: mode === 'lab' ? defaultViewFor(config) : undefined,
        note,
    }

    return (
        <LabLayout
            source={{
                ...canvasSource,
                props: canvasProps,
            }}
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
                            <CalendarCanvas {...canvasProps} />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <CalendarCanvas
                                key={`${live.programId}/${live.orgUnitId}`}
                                {...canvasProps}
                            />
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
