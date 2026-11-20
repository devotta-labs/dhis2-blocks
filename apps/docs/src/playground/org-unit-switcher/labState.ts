import type { RequestLogEntry } from '../network'
import type { LabSettings } from './labData'
import { DEFAULT_PRESET, PRESETS, type Preset } from './presets'

export interface LabState {
    mode: 'lab' | 'live'
    /** The example on show; cleared once a setting that restarts the block is changed by hand. */
    preset?: string
    settings: LabSettings
    /**
     * What the example writes to storage. The lab clears storage and writes it whenever this object is replaced, and
     * only picking an example replaces it, so a value written by hand survives until the block reads it.
     */
    seeding: { seed?: string }
    /** Storage was changed by hand since the example wrote it. */
    edited: boolean
    /** The clinic a host that follows picks adopted last; until then it holds its first value. */
    followed?: string
    /** Counts restarts: the canvas remounts on each, with a fresh cache. */
    run: number
    requests: RequestLogEntry[]
    callbacks: string[]
}

export type LabAction =
    | { type: 'switchMode'; mode: LabState['mode'] }
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'editStorage' }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }
    | { type: 'logCallback'; entry: string }
    | { type: 'adoptValue'; id: string }
    | { type: 'clearCallbacks' }

const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'collapsed',
    'texts',
    'value',
    'rtl',
])

const endsFailure = (changes: Partial<LabSettings>, key: string) => {
    if (key === 'failSearch') return changes.failSearch === false
    if (key === 'failValidity') return changes.failValidity === false
    if (key === 'network') {
        return Object.values(changes.network?.endpoints ?? {}).every(
            (endpoint) => endpoint?.behaviour === undefined
        )
    }
    return false
}

const restarted = (state: LabState) => ({
    ...state,
    run: state.run + 1,
    requests: [],
    followed: undefined,
})

/** The linked preset (`?preset=`), or Three clinics. */
export const initialLabState: (linkedPreset?: string) => LabState = (
    linkedPreset
) => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? DEFAULT_PRESET
    return {
        mode: 'lab',
        preset: preset.name,
        settings: preset.settings,
        seeding: { seed: preset.seed },
        edited: false,
        run: 0,
        requests: [],
        callbacks: [],
    }
}

export const labReducer: (state: LabState, action: LabAction) => LabState = (
    state,
    action
) => {
    switch (action.type) {
        case 'switchMode': {
            const { value } = state.settings
            return restarted({
                ...state,
                mode: action.mode,
                settings:
                    action.mode === 'live' && value === 'valid'
                        ? { ...state.settings, value: 'uncontrolled' }
                        : state.settings,
            })
        }
        case 'pickPreset':
            return restarted({
                ...state,
                preset: action.preset.name,
                settings: action.preset.settings,
                seeding: { seed: action.preset.seed },
                edited: false,
            })
        case 'changeSettings': {
            const settings = { ...state.settings, ...action.changes }
            const inPlace = Object.keys(action.changes).every(
                (key) => IN_PLACE.has(key) || endsFailure(action.changes, key)
            )
            const followed =
                'value' in action.changes ? undefined : state.followed
            return inPlace
                ? { ...state, settings, followed }
                : restarted({ ...state, preset: undefined, settings })
        }
        case 'editStorage':
            return restarted({ ...state, preset: undefined, edited: true })
        case 'restart':
            return restarted(state)
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
        case 'logCallback':
            return {
                ...state,
                callbacks: [action.entry, ...state.callbacks].slice(0, 50),
            }
        case 'clearCallbacks':
            return { ...state, callbacks: [] }
        case 'adoptValue':
            return state.settings.value === 'follows'
                ? { ...state, followed: action.id }
                : state
    }
}
