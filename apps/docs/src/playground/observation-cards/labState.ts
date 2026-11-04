import type { RequestLogEntry } from '../network'
import type { LabSettings } from './labData'
import { DEFAULT_SETTINGS, PRESETS, type Preset } from './presets'

interface Live {
    programId: string
    personId: string
    dataElementId: string
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
}

export type LabAction =
    | { type: 'switchMode'; mode: LabState['mode'] }
    | { type: 'pickPreset'; preset: Preset }
    | { type: 'changeSettings'; changes: Partial<LabSettings> }
    | { type: 'changeLive'; changes: Partial<Live> }
    | { type: 'restart' }
    | {
          type: 'logRequests'
          update: (entries: RequestLogEntry[]) => RequestLogEntry[]
      }
    | { type: 'clearRequests' }

// The docs example's person and program on the Sierra Leone demo.
const LIVE: Live = {
    programId: 'WSGAb5XwJ3Y',
    personId: 'Y8aEiTpHSSQ',
    dataElementId: 'vANAXwtLwcT',
}

/** Settings that only change props or the lab's layout, so the cards keep their data. */
const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'arrangement',
    'staleAfterDays',
    'cardWidth',
    'cardsPerRow',
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
        live: LIVE,
        run: 0,
        requests: [],
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
        // The cards refetch for new ids by themselves.
        case 'changeLive':
            return { ...state, live: { ...state.live, ...action.changes } }
        case 'restart':
            return restarted(state)
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
    }
}
