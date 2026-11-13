import type { Clinic } from '@/components/clinic-selector'
import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useReducer,
} from 'react'
import { PresetControls } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary, LabServerScope } from '../LabServer'
import type { Log } from '../network'
import { usePresetParam } from '../usePresetParam'
import { generateLabData, valueFor, type LabSettings } from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { breakStorage, clearStored, seedStored } from './labStorage'
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
    const { settings, seed, seeding, run, requests, callbacks } = state
    useEffect(
        () => setLinkedPreset(state.preset),
        [state.preset, setLinkedPreset]
    )

    // Before the block's first read, which waits for the user request; cleared again when the lab closes.
    useLayoutEffect(() => {
        seedStored(seed)
        return clearStored
    }, [seeding, seed])
    useLayoutEffect(
        () => (settings.storageThrows ? breakStorage() : undefined),
        [settings.storageThrows]
    )

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
    const onValueChange = useCallback(
        (clinic: Clinic) =>
            dispatch({
                type: 'logCallback',
                entry: `onValueChange ${JSON.stringify(clinic)}`,
            }),
        []
    )
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
        value: valueFor(settings, data),
        onCollapsedChange,
        onValueChange,
    }

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
            panel={{
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
            }}
            sidebar={
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
                    <ClinicsControls settings={settings} onChange={change} />
                    <SidebarControls settings={settings} onChange={change} />
                    <RememberedControls
                        settings={settings}
                        data={data}
                        seed={seed}
                        onChange={change}
                        onEdit={() => dispatch({ type: 'editStorage' })}
                    />
                    <ServerControls settings={settings} onChange={change} />
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
                <LabServerScope
                    key={run}
                    network={settings.network}
                    resources={RESOURCES}
                    respond={respond}
                    log={log}
                >
                    <ClinicCanvas {...canvasProps} />
                </LabServerScope>
            </CanvasBoundary>
        </LabLayout>
    )
}
