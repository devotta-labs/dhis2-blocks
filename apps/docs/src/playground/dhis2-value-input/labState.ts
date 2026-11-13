import type { EditorProblem } from '@/components/dhis2-value-input'
import type { RequestLogEntry } from '../network'
import { FILLED, LABELS, type LabSettings } from './labData'
import { DEFAULT_SETTINGS, PRESETS, type Preset } from './presets'

export interface LabState {
    mode: 'lab' | 'live'
    /** The example on show; cleared once a setting is changed by hand. */
    preset?: string
    settings: LabSettings
    /** Each field's committed value, by field id. */
    values: Record<string, string | undefined>
    /** Counts restarts: the canvas remounts on each, with a fresh cache and its opening values. */
    run: number
    requests: RequestLogEntry[]
    /** Each `onChange` call, newest first. */
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
          type: 'changed'
          field: string
          value: string | null
          problem?: EditorProblem
      }
    | { type: 'clearCallbacks' }

/** Settings that only change the fields' props, so what was typed stays. */
const IN_PLACE: ReadonlySet<string> = new Set<keyof LabSettings>([
    'required',
    'readOnly',
    'messages',
    'hideOption',
    'density',
    'rtl',
    'calendar',
    'dateFormat',
])

const restarted = (state: LabState): LabState => ({
    ...state,
    run: state.run + 1,
    requests: [],
    values: state.settings.filled ? FILLED : {},
})

/** Lab data on the linked preset (`?preset=`), or on the first one. */
export const initialLabState = (linkedPreset?: string): LabState => {
    const preset =
        PRESETS.find((each) => each.name === linkedPreset) ?? PRESETS[0]
    const settings = preset?.settings ?? DEFAULT_SETTINGS
    return {
        mode: 'lab',
        preset: preset?.name,
        settings,
        values: settings.filled ? FILLED : {},
        run: 0,
        requests: [],
        callbacks: [],
    }
}

/** One `onChange` call as the log shows it. */
const said = ({
    field,
    value,
    problem,
}: Extract<LabAction, { type: 'changed' }>) =>
    `${LABELS.get(field) ?? field}: onChange(${[value, problem]
        .filter((each) => each !== undefined)
        .map((each) => JSON.stringify(each))
        .join(', ')})`

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
        case 'restart':
            return restarted(state)
        case 'logRequests':
            return { ...state, requests: action.update(state.requests) }
        case 'clearRequests':
            return { ...state, requests: [] }
        // A problem means the typed text is not a value yet: the field keeps its last good value.
        case 'changed':
            return {
                ...state,
                values:
                    action.problem === undefined
                        ? {
                              ...state.values,
                              [action.field]: action.value ?? undefined,
                          }
                        : state.values,
                callbacks: [said(action), ...state.callbacks].slice(0, 100),
            }
        case 'clearCallbacks':
            return { ...state, callbacks: [] }
    }
}
