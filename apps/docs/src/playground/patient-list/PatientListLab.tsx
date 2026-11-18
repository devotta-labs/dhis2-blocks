import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import { LAB_ORG_UNIT, LAB_PROGRAM, generateWorld } from './labData'
import { createLabServer, RESOURCES } from './labServer'
import { initialLabState, labReducer, type Width } from './labState'
import { PatientListCanvas } from './PatientListCanvas'
import canvasSource from './PatientListCanvas.tsx?canvas'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'

const WIDTHS: ReadonlyArray<readonly [Width, string, string]> = [
    ['phone', 'Phone', 'max-w-[375px]'],
    ['tablet', 'Tablet', 'max-w-[768px]'],
    ['desktop', 'Desktop', 'max-w-[1100px]'],
    ['full', 'Full', 'max-w-none'],
]

const LIVE_FIELDS = [
    ['programId', 'Program'],
    ['orgUnitId', 'Organisation unit'],
] as const

/** The patient list on generated tracked entities, beside the requests it makes. */
export const PatientListLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
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

    const { data, server, view } = config
    const world = useMemo(() => generateWorld(data), [data])
    const respond = useMemo(
        () => createLabServer({ server }, world),
        [server, world]
    )
    const widthClass =
        WIDTHS.find(([option]) => option === width)?.[2] ?? 'max-w-none'

    const canvasProps = {
        view,
        program: mode === 'lab' ? LAB_PROGRAM : live.programId,
        orgUnit: mode === 'lab' ? LAB_ORG_UNIT : live.orgUnitId,
        note,
    }

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
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
                            {LIVE_FIELDS.map(([field, name]) => (
                                <label
                                    key={field}
                                    className="flex flex-col gap-0.5"
                                >
                                    {name}
                                    <input
                                        value={live[field]}
                                        onChange={(event) =>
                                            dispatch({
                                                type: 'changeLive',
                                                changes: {
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
                    <OptionsControls
                        view={view}
                        onChange={(next) =>
                            dispatch({ type: 'changeView', view: next })
                        }
                    />
                    {mode === 'lab' && (
                        <NetworkControls
                            network={config.network}
                            records={RESOURCES}
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
            <div className={`w-full ${widthClass} bg-dhis2-background`}>
                <CanvasBoundary key={run}>
                    {mode === 'lab' ? (
                        <LabServerScope
                            key={run}
                            network={config.network}
                            apiVersion={server.apiVersion}
                            resources={RESOURCES}
                            respond={respond}
                            log={log}
                        >
                            {/* The page size is a starting value, so a new one remounts the list. */}
                            <PatientListCanvas
                                key={view.pageSize}
                                {...canvasProps}
                            />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <PatientListCanvas
                                key={`${live.programId}/${live.orgUnitId}/${view.pageSize}`}
                                {...canvasProps}
                            />
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
