import type { LabNetwork, RequestLogEntry } from '../../network'
import type { LabConfig, LabView } from './labData'
import { DEFAULT_CONFIG, PRESETS, type Preset } from './presets'

interface Live {
    programId: string
    orgUnitId: string
}

export type Width = 'phone' | 'tablet' | 'desktop' | 'full'

export interface LabState {
    mode: 'lab' | 'live'
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    config: LabConfig
    live: Live
    width: Width
    /** Counts restarts: the canvas remounts on each, with a fresh cache and server. */
    run: number
    requests: RequestLogEntry[]
    /** The block's callbacks, newest first. */
    callbacks: string[]
}

export type LabAction =
    | { type: 'switchMode'; mode: LabState['mode'] }
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeView'; view: LabView }
    | { type: 'changeNetwork'; network: LabNetwork }
    | { type: 'changeLive'; changes: Partial<Live> }
    | { type: 'changeWidth'; width: Width }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }
    | { type: 'noteCallback'; entry: string }
    | { type: 'clearCallbacks' }

const LIVE: Live = { programId: 'IpHINAT79UW', orgUnitId: 'y77LiPqLMoq' }

const MAX_CALLBACKS = 80

const restarted = (state: LabState): LabState => ({
    ...state,
    run: state.run + 1,
    requests: [],
})

/** Lab data on the linked preset (`?preset=`), or on the first one. */
export const initialLabState = (linkedPreset?: string): LabState => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? PRESETS[0]
    return {
        mode: 'lab',
        preset: preset?.name,
        config: preset?.config ?? DEFAULT_CONFIG,
        live: LIVE,
        width: 'full',
        run: 0,
        requests: [],
        callbacks: [],
    }
}

export const labReducer = (state: LabState, action: LabAction): LabState => {
    switch (action.type) {
        case 'switchMode':
            return restarted({ ...state, mode: action.mode })
        case 'pickPreset':
            return restarted({
                ...state,
                preset: action.preset.name,
                config: action.preset.config,
                callbacks: [],
            })
        // Props apply in place.
        case 'changeView':
            return {
                ...state,
                preset: undefined,
                config: { ...state.config, view: action.view },
            }
        // A new network needs a fresh list.
        case 'changeNetwork':
            return restarted({
                ...state,
                preset: undefined,
                config: { ...state.config, network: action.network },
            })
        // The list is keyed by its ids, so it remounts by itself.
        case 'changeLive':
            return { ...state, live: { ...state.live, ...action.changes } }
        case 'changeWidth':
            return { ...state, width: action.width }
        case 'restart':
            return restarted(state)
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
        case 'noteCallback':
            return {
                ...state,
                callbacks: [action.entry, ...state.callbacks].slice(
                    0,
                    MAX_CALLBACKS
                ),
            }
        case 'clearCallbacks':
            return { ...state, callbacks: [] }
    }
}
