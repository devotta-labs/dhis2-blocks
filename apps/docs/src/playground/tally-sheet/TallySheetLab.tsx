import { useDeferredValue, useEffect, useReducer } from 'react'
import {
    tallyCounts,
    type TallyEntry,
    type TallyLayout,
} from '@/components/tally-sheet'
import { PresetControls } from '../controls'
import { LabLayout } from '../LabLayout'
import { LogPanel } from '../LogPanel'
import { CanvasBoundary } from '../LabServer'
import { usePresetParam } from '../usePresetParam'
import { describeCount, describeEntry, SHEETS, THIS_DEVICE } from './labData'
import { initialLabState, labReducer } from './labState'
import { PRESETS } from './presets'
import { HostControls, OtherDeviceControls, SheetControls } from './settings'
import { TallyCanvas } from './TallyCanvas'
import canvasSource from './TallyCanvas.tsx?canvas'

const TallyLog = ({
    layout,
    log,
    handed,
    onClear,
}: {
    layout: TallyLayout
    log: readonly TallyEntry[]
    handed: readonly TallyEntry[]
    onClear: () => void
}) => {
    const counted = useDeferredValue(log)
    return (
        <LogPanel
            callbacks={handed.map(
                (entry) => `onAppend: ${describeEntry(layout, entry)}`
            )}
            results={{
                title: 'tallyCounts',
                lines: tallyCounts(layout, counted).map((count) =>
                    describeCount(layout, count)
                ),
            }}
            onClearCallbacks={onClear}
        />
    )
}

/** The tally sheet lab: a session's log kept by a host that can be slow, joined with a second device's. */
export const TallySheetLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { settings, log, handed, run } = state
    useEffect(
        () => setLinkedPreset(state.preset),
        [state.preset, setLinkedPreset]
    )

    const { layout, label } = SHEETS[settings.sheet]
    const onAppend = (entries: readonly TallyEntry[]) => {
        dispatch({ type: 'handed', entries })
        const store = () => dispatch({ type: 'stored', run, entries })
        if (settings.hostDelay === 0) store()
        else setTimeout(store, settings.hostDelay)
    }
    const canvasProps = {
        layout,
        label,
        entries: log,
        by: THIS_DEVICE,
        rtl: settings.rtl,
        onAppend,
    }

    return (
        <LabLayout
            source={{ ...canvasSource, props: canvasProps }}
            panel={{
                title: 'Logs',
                children: (
                    <TallyLog
                        layout={layout}
                        log={log}
                        handed={handed}
                        onClear={() => dispatch({ type: 'clearHanded' })}
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
                    <SheetControls
                        settings={settings}
                        onChange={(changes) =>
                            dispatch({ type: 'changeSettings', changes })
                        }
                    />
                    <HostControls
                        settings={settings}
                        onChange={(changes) =>
                            dispatch({ type: 'changeSettings', changes })
                        }
                    />
                    <OtherDeviceControls
                        onOtherDevice={() =>
                            dispatch({ type: 'otherDevice', now: Date.now() })
                        }
                    />
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
                <TallyCanvas key={run} {...canvasProps} />
            </CanvasBoundary>
        </LabLayout>
    )
}
