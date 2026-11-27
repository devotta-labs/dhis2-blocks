import type { MapGeometry, Position } from '@/components/location-map'
import {
    FAR_POINT,
    HOLED_AREA,
    STORED_AREA,
    STORED_POINT,
    type LabSettings,
} from './labData'
import { DEFAULT_SETTINGS, PRESETS, type Preset } from './presets'

export interface LabState {
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    /** What is recorded, as DHIS2 holds it. */
    value: MapGeometry | null
    /** Counts restarts: the canvas remounts on each, on what was recorded. */
    run: number
    /** Each value the block reported, newest first. */
    callbacks: string[]
}

export type LabAction =
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'restart' }
    | { type: 'changed'; value: MapGeometry | null }
    | { type: 'clearCallbacks' }

/** Settings that change how the location is shown or checked, so what was entered stays. */
const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'orgUnit',
    'check',
    'readOnly',
    'search',
    'tiles',
])

/** What the canvas captures: the input's choice, or what the event's stage allows. */
export const captureOf = ({
    view,
    capture,
    featureType,
}: LabSettings): 'point' | 'area' | undefined => {
    if (view !== 'event') return capture
    if (featureType === 'NONE') return undefined
    return featureType === 'POINT' ? 'point' : 'area'
}

const pointAt = (coordinates: Position): MapGeometry => ({
    type: 'Point',
    coordinates,
})

/** What is recorded when the canvas opens; a multi-polygon stage holds its area as a multi-polygon of one part. */
const startValue = (settings: LabSettings): MapGeometry | null => {
    const kind = captureOf(settings)
    if (kind === 'point') {
        if (settings.start === 'far') return pointAt(FAR_POINT)
        return settings.start === 'stored' ? pointAt(STORED_POINT) : null
    }
    if (kind === undefined || settings.start === 'empty') return null
    const area = settings.start === 'holed' ? HOLED_AREA : STORED_AREA
    if (
        settings.view === 'event' &&
        settings.featureType === 'MULTI_POLYGON' &&
        area.type === 'Polygon'
    ) {
        return { type: 'MultiPolygon', coordinates: [area.coordinates] }
    }
    return area
}

const restarted = (state: LabState): LabState => ({
    ...state,
    run: state.run + 1,
    value: startValue(state.settings),
    callbacks: [],
})

/** The lab on the linked preset (`?preset=`), or on the first one. */
export const initialLabState = (linkedPreset?: string): LabState => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? PRESETS[0]
    return restarted({
        preset: preset?.name,
        settings: preset?.settings ?? DEFAULT_SETTINGS,
        value: null,
        run: -1,
        callbacks: [],
    })
}

export const labReducer = (state: LabState, action: LabAction): LabState => {
    switch (action.type) {
        case 'pickPreset':
            return restarted({
                ...state,
                preset: action.preset.name,
                settings: action.preset.settings,
            })
        case 'changeSettings': {
            const next: LabState = {
                ...state,
                preset: undefined,
                settings: { ...state.settings, ...action.changes },
            }
            return Object.keys(action.changes).every((key) => IN_PLACE.has(key))
                ? next
                : restarted(next)
        }
        case 'restart':
            return restarted(state)
        case 'changed':
            return {
                ...state,
                value: action.value,
                callbacks: [
                    `onChange(${JSON.stringify(action.value)})`,
                    ...state.callbacks,
                ].slice(0, 100),
            }
        case 'clearCallbacks':
            return { ...state, callbacks: [] }
    }
}
