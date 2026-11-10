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
import { BannerCanvas } from './BannerCanvas'
import bannerSource from './BannerCanvas.tsx?canvas'
import {
    generateLabData,
    LAB_PERSON,
    LIVE_PARTS,
    SUBJECTS,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { QuickLookCanvas } from './QuickLookCanvas'
import quickLookSource from './QuickLookCanvas.tsx?canvas'
import { OptionsControls } from './settings'

/** The tracked entity header lab: the banner and a popover of the same parts, beside the requests they make. */
export const TrackedEntityHeaderLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, canvas, settings, live, run, requests } = state
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

    const subject = SUBJECTS[settings.person]
    const canvasProps = {
        trackedEntity: mode === 'lab' ? LAB_PERSON : live.personId,
        program: mode === 'lab' ? subject.program : live.programId,
        parts: mode === 'lab' ? subject.parts : LIVE_PARTS,
        settings: { arrangement: settings.arrangement, width: settings.width },
    }
    const Canvas = canvas === 'banner' ? BannerCanvas : QuickLookCanvas
    const source = canvas === 'banner' ? bannerSource : quickLookSource

    return (
        <LabLayout
            source={{ ...source, props: canvasProps }}
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
                    <Section title="Canvas">
                        <Segmented
                            value={canvas}
                            options={[
                                ['banner', 'Banner'],
                                ['quick-look', 'Quick look'],
                            ]}
                            onChange={(next) =>
                                dispatch({ type: 'switchCanvas', canvas: next })
                            }
                        />
                    </Section>
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
                                records={['tracker/trackedEntities']}
                                onChange={(network) => change({ network })}
                            />
                        </>
                    ) : (
                        <Section title="Live DHIS2">
                            {(
                                [
                                    ['programId', 'Program'],
                                    ['personId', 'Person (tracked entity)'],
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
                        network={settings.network}
                        resources={RESOURCES}
                        respond={respond}
                        log={log}
                        systemInfo={data.systemInfo}
                    >
                        <Canvas {...canvasProps} />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <Canvas {...canvasProps} />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
