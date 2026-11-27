import type { RequestLogEntry } from '../network'
import type { LabSettings } from './labData'
import { DEFAULT_SETTINGS, PRESETS, type Preset } from './presets'

export interface LabState {
    mode: 'lab' | 'live'
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    /** Counts restarts: the canvas remounts on each, with a fresh cache and a fresh server. */
    run: number
    requests: RequestLogEntry[]
    /** Each `onSaved`, `onDirtyChange` and `onUnsavedRuleChanges` call, newest first. */
    callbacks: string[]
}

export type LabAction =
    | { type: 'switchMode'; mode: LabState['mode'] }
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }
    | {
          type: 'called'
          callback: 'onSaved' | 'onDirtyChange' | 'onUnsavedRuleChanges'
          value: boolean | number | { eventId: string; status: string }
      }
    | { type: 'clearCallbacks' }

const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'network',
    'blame',
    'confirmSaved',
    'locationWarnKm',
])

const restarted = (state: LabState) =>
    ({
        ...state,
        run: state.run + 1,
        requests: [],
    }) satisfies LabState

/** Lab data on the linked preset (`?preset=`), else the first preset. */
export const initialLabState = ({
    preset: linkedPreset,
}: { preset?: string } = {}) => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? PRESETS[0]
    return {
        mode: 'lab',
        preset: preset?.name,
        settings: preset?.settings ?? DEFAULT_SETTINGS,
        run: 0,
        requests: [],
        callbacks: [],
    } satisfies LabState
}

export const labReducer = (state: LabState, action: LabAction) => {
    switch (action.type) {
        case 'switchMode':
            return restarted({ ...state, mode: action.mode }) satisfies LabState
        case 'pickPreset':
            return restarted({
                ...state,
                preset: action.preset.name,
                settings: action.preset.settings,
            }) satisfies LabState
        case 'changeSettings': {
            const next: LabState = {
                ...state,
                preset: undefined,
                settings: { ...state.settings, ...action.changes },
            }
            const inPlace = Object.keys(action.changes).every((key) =>
                IN_PLACE.has(key)
            )
            return (inPlace ? next : restarted(next)) satisfies LabState
        }
        case 'restart':
            return restarted(state) satisfies LabState
        case 'logRequests':
            return {
                ...state,
                requests: action.update(state.requests),
            } satisfies LabState
        case 'clearRequests':
            return { ...state, requests: [] } satisfies LabState
        case 'called':
            return {
                ...state,
                callbacks: [
                    `${action.callback}(${JSON.stringify(action.value)})`,
                    ...state.callbacks,
                ].slice(0, 100),
            } satisfies LabState
        case 'clearCallbacks':
            return { ...state, callbacks: [] } satisfies LabState
    }
}
