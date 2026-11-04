import type { RequestLogEntry } from '../network'
import type { LabComposition, LabSettings } from './labData'
import {
    DEFAULT_SETTINGS,
    LIVE_PRESETS,
    PRESETS,
    type LivePreset,
    type Preset,
} from './presets'

/** An attribute the composer can offer, from the lab program or a live one. */
export interface KnownAttribute {
    id: string
    label: string
    valueType: string
}

interface Live {
    program: string
    composition: LabComposition
    /** The live program's searchable attributes, once the finder has loaded it. */
    attributes: KnownAttribute[]
}

export interface LabState {
    mode: 'lab' | 'live'
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    live: Live
    /** Counts restarts: the canvas remounts on each, with a fresh cache. */
    run: number
    requests: RequestLogEntry[]
    /** Each person `onSelect` was called with, newest first. */
    callbacks: string[]
}

export type LabAction =
    | { type: 'switchMode'; mode: LabState['mode'] }
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'changeComposition'; composition: LabComposition }
    | { type: 'pickLiveProgram'; preset: Pick<LivePreset, 'program' | 'forms'> }
    | { type: 'liveAttributes'; attributes: KnownAttribute[] }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }
    | { type: 'selected'; person: unknown }
    | { type: 'clearCallbacks' }

/** Live programs open with their forms one at a time, and rows of the finder's own choosing. */
const liveComposition = (forms: LabComposition['forms']): LabComposition => ({
    ...DEFAULT_SETTINGS.composition,
    forms,
    formLayout: 'swap',
    rowAttributes: [],
})

const liveFor = (preset: Pick<LivePreset, 'program' | 'forms'>): Live => ({
    program: preset.program,
    composition: liveComposition(preset.forms),
    attributes: [],
})

/** Settings that only change how the finder is composed or framed, so it keeps its state and cache. */
const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'composition',
    'width',
    'rtl',
])

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
        settings: preset?.settings ?? DEFAULT_SETTINGS,
        live: liveFor(LIVE_PRESETS[0]),
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
                settings: action.preset.settings,
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
        // The composer edits whichever finder is on show.
        case 'changeComposition':
            return state.mode === 'lab'
                ? labReducer(state, {
                      type: 'changeSettings',
                      changes: { composition: action.composition },
                  })
                : {
                      ...state,
                      live: { ...state.live, composition: action.composition },
                  }
        // The finder starts afresh for a new program by itself.
        case 'pickLiveProgram':
            return { ...state, live: liveFor(action.preset) }
        case 'liveAttributes':
            return {
                ...state,
                live: { ...state.live, attributes: action.attributes },
            }
        case 'restart':
            return restarted(state)
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
        case 'selected':
            return {
                ...state,
                callbacks: [
                    `onSelect ${JSON.stringify(action.person)}`,
                    ...state.callbacks,
                ].slice(0, 50),
            }
        case 'clearCallbacks':
            return { ...state, callbacks: [] }
    }
}
