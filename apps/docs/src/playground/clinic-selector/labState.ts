import type { RequestLogEntry } from '../network'
import type { LabSettings } from './labData'
import { DEFAULT_PRESET, PRESETS, type Preset, type Seed } from './presets'

export interface LabState {
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    /** What the example wrote to storage, shown beside the stored value. */
    seed: Seed
    /** Counts examples picked: the lab clears storage and writes `seed` on each. */
    seeding: number
    /** Counts restarts: the canvas remounts on each, with a fresh cache. */
    run: number
    requests: RequestLogEntry[]
    callbacks: string[]
}

export type LabAction =
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    /** The lab's own buttons changed storage, so the block reads it again. */
    | { type: 'editStorage' }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }
    | { type: 'logCallback'; entry: string }
    | { type: 'clearCallbacks' }

/** Settings that only change the block's props, so it keeps its state. */
const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'collapsed',
    'label',
    'value',
])

const restarted = (state: LabState): LabState => ({
    ...state,
    run: state.run + 1,
    requests: [],
})

/** The linked preset (`?preset=`), or Three clinics. */
export const initialLabState = (linkedPreset?: string): LabState => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? DEFAULT_PRESET
    return {
        preset: preset.name,
        settings: preset.settings,
        seed: preset.seed ?? {},
        seeding: 0,
        run: 0,
        requests: [],
        callbacks: [],
    }
}

export const labReducer = (state: LabState, action: LabAction): LabState => {
    switch (action.type) {
        case 'pickPreset':
            return restarted({
                ...state,
                preset: action.preset.name,
                settings: action.preset.settings,
                seed: action.preset.seed ?? {},
                seeding: state.seeding + 1,
            })
        case 'changeSettings': {
            const next: LabState = {
                ...state,
                preset: undefined,
                settings: { ...state.settings, ...action.changes },
            }
            const inPlace = Object.keys(action.changes).every((key) =>
                IN_PLACE.has(key)
            )
            return inPlace ? next : restarted(next)
        }
        case 'editStorage':
            return restarted({ ...state, preset: undefined, seed: {} })
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
    }
}
