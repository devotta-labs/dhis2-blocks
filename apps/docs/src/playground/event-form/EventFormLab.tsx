import type { EventFormSaved } from '@/components/event-form'
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
import { EventFormCanvas } from './EventFormCanvas'
import canvasSource from './EventFormCanvas.tsx?canvas'
import { EXAMPLES, labEvents, type LabSettings } from './labData'
import { answer, RECORDS, RESOURCES } from './labServer'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { OptionsControls } from './settings'

/** The event form lab: a child visit whose rules use every effect, and real and generated stages, saved to a fake DHIS2. */
export const EventFormLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        { preset: linkedPreset },
        initialLabState
    )
    const { mode, settings, run, requests, callbacks } = state
    const linked = mode === 'lab' ? state.preset : undefined
    useEffect(() => setLinkedPreset(linked), [linked, setLinkedPreset])

    const change = (changes: Partial<LabSettings>) =>
        dispatch({ type: 'changeSettings', changes })
    // Stable, so the lab server is not rebuilt on every request it logs.
    const log: Log = useCallback(
        (update) => dispatch({ type: 'logRequests', update }),
        []
    )
    const onSaved = useCallback(
        ({ eventId, status }: EventFormSaved) =>
            dispatch({
                type: 'called',
                callback: 'onSaved',
                value: { eventId, status },
            }),
        []
    )
    const onDirtyChange = useCallback(
        (dirty: boolean) =>
            dispatch({
                type: 'called',
                callback: 'onDirtyChange',
                value: dirty,
            }),
        []
    )

    const onUnsavedRuleChanges = useCallback(
        (count: number) =>
            dispatch({
                type: 'called',
                callback: 'onUnsavedRuleChanges',
                value: count,
            }),
        []
    )

    const {
        example,
        blame,
        confirmSaved,
        locationWarnKm,
        mayUncomplete,
        network,
    } = settings
    // Fresh events each run, so what one run saves is gone in the next.
    const respond = useMemo(
        () => answer({ example, mayUncomplete }, labEvents(example)),
        [example, mayUncomplete, run]
    )
    // Live DHIS2 always opens RMNCH, whose ids exist on the docs' instance.
    const shown = EXAMPLES[mode === 'lab' ? example : 'rmnch']
    const canvasProps = {
        programId: shown.programId,
        programStageId: shown.programStageId,
        orgUnitId: shown.orgUnitId,
        eventId: shown.eventId,
        enrollmentId: shown.enrollmentId,
        trackedEntityId: shown.trackedEntityId,
        blame,
        confirmSaved,
        locationWarnKm,
        onSaved,
        onDirtyChange,
        onUnsavedRuleChanges,
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
            <CanvasBoundary key={run}>
                {mode === 'lab' ? (
                    <LabServerScope
                        key={run}
                        network={network}
                        resources={RESOURCES}
                        respond={respond}
                        log={log}
                    >
                        <EventFormCanvas {...canvasProps} />
                    </LabServerScope>
                ) : (
                    <LivePreviewHost
                        key={run}
                        placeholder={<PreviewSpinner className="h-96" />}
                    >
                        <EventFormCanvas {...canvasProps} />
                    </LivePreviewHost>
                )}
            </CanvasBoundary>
        </LabLayout>
    )
}
