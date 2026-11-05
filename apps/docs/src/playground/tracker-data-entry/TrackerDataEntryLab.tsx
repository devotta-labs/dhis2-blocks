import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import { generateLabData, SOURCES, type LabSettings } from './labData'
import { answer, RECORDS, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { TrackerDataEntryCanvas } from './TrackerDataEntryCanvas'
import canvasSource from './TrackerDataEntryCanvas.tsx?canvas'

/** The tracker data entry lab: an event grid, one person's events and a register, typed in and saved to a fake DHIS2. */
export const TrackerDataEntryLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, run, requests } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )

    const { example, rules, refuse, network } = settings
    // Fresh data each run, so what one run saves is gone in the next.
    const data = useMemo(() => generateLabData({ example }), [example, run])
    const respond = useMemo(
        () => answer({ example, rules, refuse }, data),
        [example, rules, refuse, data]
    )
    const canvasProps = useMemo(
        () => ({ options: SOURCES[example] }),
        [example]
    )
    // Kept as one element: app-runtime's data provider makes a new engine each time it renders, and the block loads
    // its form again for a new engine, so the canvas must not render again for every request the log adds.
    const canvas = useMemo(
        () => (
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={network}
                        resources={RESOURCES}
                        respond={respond}
                        log={log}
                    >
                        <TrackerDataEntryCanvas {...canvasProps} />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <TrackerDataEntryCanvas {...canvasProps} />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        ),
        [run, mode, network, respond, log, canvasProps]
    )

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
            panel={
                mode === 'lab'
                    ? {
                          title: 'Logs',
                          children: (
                              <LogPanel
                                  requests={requests}
                                  onClearRequests={() =>
                                      dispatch({ type: 'clearRequests' })
                                  }
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
                        onChange={(next) =>
                            dispatch({ type: 'switchMode', mode: next })
                        }
                    />
                    {/* The examples use the docs' DHIS2 ids, so they open there too. */}
                    <PresetControls
                        presets={PRESETS}
                        selected={state.preset}
                        onPick={(preset) =>
                            dispatch({ type: 'pickPreset', preset })
                        }
                    />
                    {mode === 'lab' ? (
                        <>
                            <OptionsControls
                                settings={settings}
                                onChange={change}
                            />
                            <NetworkControls
                                network={network}
                                records={RECORDS}
                                onChange={(next) => change({ network: next })}
                            />
                        </>
                    ) : null}
                    <button
                        type="button"
                        className="self-start"
                        onClick={() => dispatch({ type: 'restart' })}
                    >
                        Restart
                    </button>
                </>
            }
        >
            {canvas}
        </LabLayout>
    )
}
