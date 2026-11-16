import type { EditorProblem } from '@/components/dhis2-value-input'
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
import {
    HIDDEN_OPTIONS,
    NAMES,
    READ_ONLY_REASON,
    STORED_FILES,
    type LabSettings,
} from './labData'
import { answer, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'
import { ValueInputCanvas } from './ValueInputCanvas'
import canvasSource from './ValueInputCanvas.tsx?canvas'

const MESSAGES = {
    none: [],
    error: [{ tone: 'error', text: 'Check this value against the register' }],
    warning: [{ tone: 'warning', text: 'This is unusual for this patient' }],
} as const

// One empty list, so the fields' hidden options keep their identity across renders.
const NONE_HIDDEN: string[] = []

/** The value input lab: a field of every DHIS2 value type, and every value each one reports. */
export const ValueInputLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { mode, settings, values, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const onChange = useCallback(
        (field: string, value: string | null, problem?: EditorProblem) =>
            dispatch({ type: 'changed', field, value, problem }),
        []
    )

    // What this run uploads, so its names are known until the next.
    const uploads = useMemo(() => new Map<string, string>(), [run])
    const respond = useMemo(() => answer(uploads), [uploads])
    const canvasProps = {
        settings: {
            calendar: settings.calendar,
            dateFormat: settings.dateFormat,
        },
        values,
        required: settings.required,
        readOnly: settings.readOnly ? READ_ONLY_REASON : undefined,
        messages: MESSAGES[settings.messages],
        hiddenOptions: settings.hideOption ? HIDDEN_OPTIONS : NONE_HIDDEN,
        density: settings.density,
        rtl: settings.rtl,
        names: { ...NAMES, ...Object.fromEntries(uploads) },
        files: STORED_FILES,
        onChange,
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
                    {/* The fields need no ids, so the examples open on live DHIS2 too. */}
                    <PresetControls
                        presets={PRESETS}
                        selected={state.preset}
                        onPick={(preset) =>
                            dispatch({ type: 'pickPreset', preset })
                        }
                    />
                    <OptionsControls settings={settings} onChange={change} />
                    {mode === 'lab' ? (
                        <NetworkControls
                            network={settings.network}
                            records={RESOURCES}
                            onChange={(network) => change({ network })}
                        />
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
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={settings.network}
                        resources={RESOURCES}
                        respond={respond}
                        log={log}
                    >
                        <ValueInputCanvas {...canvasProps} />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <ValueInputCanvas {...canvasProps} />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
