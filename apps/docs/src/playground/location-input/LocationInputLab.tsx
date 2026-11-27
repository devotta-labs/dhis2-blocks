import { useCallback, useEffect, useMemo, useReducer } from 'react'
import { nominatimSearch } from '@/components/location-input'
import type { LocationGeometry } from '@/components/location-map'
import { PresetControls } from '../controls'
import { LabLayout } from '../LabLayout'
import { CanvasBoundary } from '../LabServer'
import { LogPanel } from '../LogPanel'
import { usePresetParam } from '../usePresetParam'
import { deviceFor } from './device'
import { ORG_UNITS, READ_ONLY_REASON, TILES, WARN_KM } from './labData'
import { captureOf, initialLabState, labReducer } from './labState'
import { LocationCanvas } from './LocationCanvas'
import canvasSource from './LocationCanvas.tsx?canvas'
import { PRESETS } from './presets'
import {
    DeviceControls,
    MapControls,
    ValueControls,
    ViewControls,
} from './settings'

/** The location blocks: the input in a form, the map on its own, and an event's own location. */
export const LocationInputLab = () => {
    const [linkedPreset, setLinkedPreset] = usePresetParam()
    const [state, dispatch] = useReducer(
        labReducer,
        linkedPreset,
        initialLabState
    )
    const { settings, run, value, callbacks } = state
    useEffect(
        () => setLinkedPreset(state.preset),
        [state.preset, setLinkedPreset]
    )

    const change = (changes: Partial<typeof settings>) =>
        dispatch({ type: 'changeSettings', changes })
    const onChange = useCallback(
        (next: LocationGeometry | null) =>
            dispatch({ type: 'changed', value: next }),
        []
    )
    // A fresh device each run, so a walk starts from its first stop.
    const locator = useMemo(
        () => deviceFor(settings.device),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [settings.device, run]
    )

    const canvasProps = {
        view: settings.view,
        capture: captureOf(settings),
        featureType: settings.featureType,
        value,
        orgUnit: ORG_UNITS[settings.orgUnit],
        warnKm: settings.check ? WARN_KM : undefined,
        readOnly: settings.readOnly ? READ_ONLY_REASON : undefined,
        search: settings.search ? nominatimSearch : undefined,
        tiles: TILES[settings.tiles],
        locator,
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
                        onClearCallbacks={() =>
                            dispatch({ type: 'clearCallbacks' })
                        }
                        onClearRequests={() => {}}
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
                    <ViewControls settings={settings} onChange={change} />
                    <ValueControls settings={settings} onChange={change} />
                    <MapControls settings={settings} onChange={change} />
                    <DeviceControls settings={settings} onChange={change} />
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
                <LocationCanvas key={run} {...canvasProps} />
            </CanvasBoundary>
        </LabLayout>
    )
}
