import { useMemo } from 'react'
import { PresetControls, Section, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { LabRun, useLabRun } from '../LabRun'
import { NetworkControls } from '../NetworkControls'
import { generateLabData, LAB_PERSON, type LabSettings } from './labData'
import { answer, labNetwork, resourcesOf } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { TimelineCanvas } from './TimelineCanvas'
import canvasSource from './TimelineCanvas.tsx?canvas'

/** The timeline lab: a person's history in every state, one click each, beside the requests it makes. */
export const TimelineLab = () => {
    const [state, dispatch, log] = useLabRun(labReducer, initialLabState)
    const { mode, settings, live, run, requests } = state

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })

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
                ...canvasSource,
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
            <LabRun
                run={run}
                mode={mode}
                network={network}
                resources={resources}
                respond={respond}
                log={log}
                systemInfo={data.systemInfo}
            >
                <TimelineCanvas {...canvasProps} />
            </LabRun>
        </LabLayout>
    )
}
