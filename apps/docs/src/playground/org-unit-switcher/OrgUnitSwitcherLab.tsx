import type { OrgUnit } from '@/components/org-unit-switcher'
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
import {
    generateLabData,
    LAB_TEXTS,
    valueFor,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { writeStored } from './labStorage'
import { PRESETS } from './presets'
import {
    OrgUnitsControls,
    RememberedControls,
    ServerControls,
    SidebarControls,
} from './settings'
import { OrgUnitCanvas } from './OrgUnitCanvas'
import canvasSource from './OrgUnitCanvas.tsx?canvas'

/** The organisation unit switcher lab: every state of the switcher, one click each, beside the requests it makes and what it stores. */
export const OrgUnitSwitcherLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, seeding, edited, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    useLayoutEffect(() => {
        writeStored(seeding.seed)
        return () => writeStored()
    }, [seeding])

    const change = useCallback(
        (changes: Partial<LabSettings>) =>
            dispatch({ type: 'changeSettings', changes }),
        []
    )
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const onValueChange = useCallback((orgUnit: OrgUnit) => {
        dispatch({
            type: 'logCallback',
            entry: `onValueChange ${JSON.stringify(orgUnit)}`,
        })
        dispatch({ type: 'adoptValue', id: orgUnit.id })
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
        texts: LAB_TEXTS[settings.texts],
        value:
            state.followed ??
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
                            <OrgUnitsControls
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
                            <OrgUnitCanvas {...canvasProps} />
                        </LabServerScope>
                    ) : (
                        <LivePreviewHost
                            key={run}
                            placeholder={<PreviewSpinner className="h-96" />}
                        >
                            <OrgUnitCanvas {...canvasProps} />
                        </LivePreviewHost>
                    )}
                </CanvasBoundary>
            </div>
        </LabLayout>
    )
}
