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
import { generateLabData, LAB_PERSON, type LabSettings } from './labData'
import { answer, labNetwork, resourcesOf } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { TimelineCanvas } from './TimelineCanvas'
import canvasCode from './TimelineCanvas.tsx?raw'

/** The timeline lab: a person's history in every state, one click each, beside the requests it makes. */
export const TimelineLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, live, run, requests } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )

    const data = useMemo(() => generateLabData(settings), [settings])
    const respond = useMemo(() => answer(settings, data), [settings, data])
    const resources = useMemo(() => resourcesOf(data), [data])
    const network = useMemo(() => labNetwork(settings, data), [settings, data])
    const livePrograms = live.programs
        .split(',')
        .map((id) => id.trim())
        .filter(Boolean)

    const canvasProps = {
        trackedEntity: mode === 'lab' ? LAB_PERSON : live.trackedEntity,
        programs:
            mode === 'live' && livePrograms.length > 0
                ? livePrograms
                : undefined,
        timeField: settings.timeField,
        step: settings.step,
        locale: settings.locale,
    }

    return (
        <LabLayout
            source={{
                name: 'TimelineCanvas.tsx',
                code: canvasCode,
                props: canvasProps,
            }}
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
                    {mode === 'lab' ? (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={state.preset}
                                onPick={(preset) =>
                                    dispatch({ type: 'pickPreset', preset })
                                }
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
                            <OptionsControls
                                live
                                settings={settings}
                                onChange={change}
                            />
                        </>
                    )}
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
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={network}
                        resources={resources}
                        respond={respond}
                        log={log}
                        systemInfo={data.systemInfo}
                    >
                        <TimelineCanvas {...canvasProps} />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <TimelineCanvas {...canvasProps} />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
