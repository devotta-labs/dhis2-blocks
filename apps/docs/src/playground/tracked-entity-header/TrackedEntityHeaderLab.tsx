import { FetchError } from '@dhis2/app-runtime'
import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Section, Segmented, SegmentedRow } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import { NetworkControls } from '../NetworkControls'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import { BannerCanvas } from './BannerCanvas'
import bannerSource from './BannerCanvas.tsx?canvas'
import { generateLabData, LAB_PERSON, type LabSettings } from './labData'
import { LIVE_PARTS, partsFor, SUBJECTS } from './labSubjects'
import { answer, LabHttpError, RESOURCES, type LabRequest } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { QuickLookCanvas } from './QuickLookCanvas'
import quickLookSource from './QuickLookCanvas.tsx?canvas'
import { SidebarCanvas } from './SidebarCanvas'
import sidebarSource from './SidebarCanvas.tsx?canvas'
import { OptionsControls } from './settings'

/** The tracked entity header lab: the banner and a popover of the same parts, beside the requests they make. */
const CANVASES = {
    banner: { Canvas: BannerCanvas, source: bannerSource },
    'quick-look': { Canvas: QuickLookCanvas, source: quickLookSource },
    sidebar: { Canvas: SidebarCanvas, source: sidebarSource },
}

/**
 * The block tells a refused or missing record from any other failure by
 * app-runtime's own error, so the lab server's HTTP failures become one.
 */
const asFetchError = ({ message, details }: LabHttpError) =>
    new FetchError({
        type: details.httpStatusCode === 403 ? 'access' : 'unknown',
        message,
        details,
    })

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
    const respond = useMemo(() => {
        const respondTo = answer(settings, data)
        return async (request: LabRequest) => {
            try {
                return await respondTo(request)
            } catch (error) {
                throw error instanceof LabHttpError
                    ? asFetchError(error)
                    : error
            }
        }
    }, [settings, data])

    const subject = SUBJECTS[settings.record]
    const canvasProps = {
        trackedEntity: mode === 'lab' ? LAB_PERSON : live.trackedEntityId,
        program: mode === 'lab' ? subject.program : live.programId,
        parts: mode === 'lab' ? partsFor(settings) : LIVE_PARTS,
        settings: {
            arrangement: settings.arrangement,
            width: settings.width,
            frame: settings.frame,
        },
    }
    const { Canvas, source } = CANVASES[canvas]

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
                    {mode === 'lab' ? (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={state.preset}
                                onPick={(preset) =>
                                    dispatch({ type: 'pickPreset', preset })
                                }
                            />
                            {canvas === 'banner' ? null : (
                                <p className="m-0 text-xs text-dhis2-muted-foreground">
                                    Your own layout from the parts. This is an
                                    example, not a layout the block ships.
                                </p>
                            )}
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
                            <SegmentedRow
                                label="Canvas"
                                value={canvas}
                                options={[
                                    ['banner', 'Banner'],
                                    ['quick-look', 'Quick look'],
                                    ['sidebar', 'Sidebar'],
                                ]}
                                onChange={(next) =>
                                    dispatch({
                                        type: 'switchCanvas',
                                        canvas: next,
                                    })
                                }
                            />
                            {(
                                [
                                    ['programId', 'Program'],
                                    ['trackedEntityId', 'Tracked entity'],
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
            <div dir={mode === 'lab' && settings.rtl ? 'rtl' : 'ltr'}>
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
            </div>
        </LabLayout>
    )
}
