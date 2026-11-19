import type { Clinic } from '@/components/clinic-selector'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
} from 'react'
import { LivePreviewHost } from '../../preview/LivePreviewHost'
import { PreviewSpinner } from '../../preview/PreviewShell'
import { PresetControls, Segmented } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import { generateLabData, valueFor, type LabSettings } from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { writeStored } from './labStorage'
import { PRESETS } from './presets'
import {
    ClinicsControls,
    RememberedControls,
    ServerControls,
    SidebarControls,
} from './settings'
import { ClinicCanvas } from './ClinicCanvas'
import canvasSource from './ClinicCanvas.tsx?canvas'

/** The clinic selector lab: every state of the switcher, one click each, beside the requests it makes and what it stores. */
export const ClinicSelectorLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, seeding, edited, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    // Before the block's first read, which waits for the user request; cleared again when the lab closes.
    useLayoutEffect(() => {
        writeStored(seeding.seed)
        return () => writeStored()
    }, [seeding])

    const change = useCallback(
        (changes: Partial<LabSettings>) =>
            dispatch({ type: 'changeSettings', changes }),
        []
    )
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const onValueChange = useCallback((clinic: Clinic) => {
        dispatch({
            type: 'logCallback',
            entry: `onValueChange ${JSON.stringify(clinic)}`,
        })
        dispatch({ type: 'adoptValue', id: clinic.id })
    }, [])
    const onCollapsedChange = useCallback(
        (collapsed: boolean) => change({ collapsed }),
        [change]
    )

    const data = useMemo(() => generateLabData(settings), [settings])
    const respond = useMemo(() => answer(settings, data), [settings, data])
    const selected = PRESETS.find(({ name }) => name === state.preset)

    const canvasProps = {
        collapsed: settings.collapsed,
        label: settings.label,
        value:
            state.followed ??
            // A live instance has no lab clinic to start on, so the host holds none until the first pick.
            (mode === 'live' && settings.value === 'follows'
                ? undefined
                : valueFor(settings, data)),
        onCollapsedChange,
        onValueChange,
    }

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
            panel={
                mode === 'lab'
                    ? {
                          title: 'Logs',
                          children: (
                              <LogPanel
                                  callbacks={callbacks}
                                  requests={requests}
                                  onClearCallbacks={() =>
                                      dispatch({ type: 'clearCallbacks' })
                                  }
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
                    {mode === 'lab' && (
                        <>
                            <PresetControls
                                presets={PRESETS}
                                selected={state.preset}
                                onPick={(preset) =>
                                    dispatch({ type: 'pickPreset', preset })
                                }
                            />
                            {selected?.description && (
                                <p className="m-0 text-xs text-muted-foreground">
                                    {selected.description}
                                </p>
                            )}
                            <ClinicsControls
                                settings={settings}
                                onChange={change}
                            />
                        </>
                    )}
                    <SidebarControls
                        settings={settings}
                        live={mode === 'live'}
                        onChange={change}
                    />
                    <RememberedControls
                        data={mode === 'lab' ? data : undefined}
                        seed={
                            edited || mode === 'live' ? undefined : seeding.seed
                        }
                        onEdit={() => dispatch({ type: 'editStorage' })}
                    />
                    {mode === 'lab' && (
                        <ServerControls settings={settings} onChange={change} />
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
            <div dir={settings.rtl ? 'rtl' : 'ltr'}>
                <CanvasBoundary key={run}>
                    {mode === 'lab' ? (
                        <LabServerScope
                            key={run}
                            network={settings.network}
                            resources={RESOURCES}
                            respond={respond}
                            log={log}
                        >
                            <ClinicCanvas {...canvasProps} />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <ClinicCanvas {...canvasProps} />
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
