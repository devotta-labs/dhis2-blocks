import type { TallyEntry } from '@/components/tally-sheet'
import {
    OTHER_DEVICE_TAPS,
    otherDeviceTaps,
    sessionLog,
    SHEETS,
    type LabSettings,
} from './labData'
import { DEFAULT_SETTINGS, PRESETS, type Preset } from './presets'

const HANDED_KEPT = 200

export interface LabState {
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    /** The session's log as the host holds it: what the sheet gets as `entries`. */
    log: readonly TallyEntry[]
    /** Each entry handed to `onAppend`, newest first. */
    handed: readonly TallyEntry[]
    /** How many taps the second device has made this run. */
    otherTaps: number
    /** Counts restarts: the canvas remounts on each, on a fresh log. */
    run: number
}

export type LabAction =
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'restart' }
    | { type: 'handed'; entries: readonly TallyEntry[] }
    | { type: 'stored'; run: number; entries: readonly TallyEntry[] }
    | { type: 'otherDevice'; now: number }
    | { type: 'clearHanded' }

const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'rtl',
    'hostDelay',
])

const opened = (
    settings: LabSettings,
    preset: string | undefined,
    run: number
) =>
    ({
        preset,
        settings,
        log: sessionLog(settings),
        handed: [],
        otherTaps: 0,
        run,
    }) satisfies LabState

/** The linked preset (`?preset=`), or the first one. */
export const initialLabState: (linkedPreset?: string) => LabState = (
    linkedPreset
) => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? PRESETS[0]
    return opened(preset?.settings ?? DEFAULT_SETTINGS, preset?.name, 0)
}

export const labReducer: (state: LabState, action: LabAction) => LabState = (
    state,
    action
) => {
    switch (action.type) {
        case 'pickPreset':
            return opened(
                action.preset.settings,
                action.preset.name,
                state.run + 1
            )
        case 'changeSettings': {
            const settings = { ...state.settings, ...action.changes }
            const inPlace = Object.keys(action.changes).every((key) =>
                IN_PLACE.has(key)
            )
            return inPlace
                ? { ...state, preset: undefined, settings }
                : opened(settings, undefined, state.run + 1)
        }
        case 'restart':
            return opened(state.settings, state.preset, state.run + 1)
        case 'handed':
            return {
                ...state,
                handed: [...action.entries]
                    .reverse()
                    .concat(state.handed)
                    .slice(0, HANDED_KEPT),
            }
        case 'stored':
            return action.run === state.run
                ? { ...state, log: [...state.log, ...action.entries] }
                : state
        case 'otherDevice':
            return {
                ...state,
                log: [
                    ...state.log,
                    ...otherDeviceTaps(
                        SHEETS[state.settings.sheet].layout,
                        state.otherTaps,
                        action.now
                    ),
                ],
                otherTaps: state.otherTaps + OTHER_DEVICE_TAPS,
            }
        case 'clearHanded':
            return { ...state, handed: [] }
    }
}
