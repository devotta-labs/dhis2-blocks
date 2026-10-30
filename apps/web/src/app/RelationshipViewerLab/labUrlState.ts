import type { RelationshipViewerLayout } from '@/components/relationship-viewer'
import { SCENARIO_IDS, type ScenarioId } from './scenarios'

export interface LabState {
    source: 'fixture' | 'live'
    scenario: ScenarioId
    size: number // the generated outbreak only
    seed?: string // fixture: replaces the scenario's seeds
    te?: string // live: one seed
    program?: string // live: the program rules read, and the seed query's
    orgUnit?: string // live: seeds from a query in this org unit
    hops?: number // unset: the scenario's default, or 1 live
    cap: number
    layout: RelationshipViewerLayout
}

const DEFAULTS = {
    source: 'fixture',
    scenario: 'hubs',
    size: 300,
    cap: 500,
    layout: 'web',
} as const
const DEFAULTS_BY_KEY = new Map(Object.entries(DEFAULTS))

const clamp = (value: string | null, min: number, max: number) => {
    const n = Number.parseInt(value ?? '', 10)
    return Number.isNaN(n) ? undefined : Math.min(max, Math.max(min, n))
}

const oneOf = <T extends string>(
    value: string | null,
    options: readonly T[],
    fallback: T
): T => options.find((option) => option === value) ?? fallback

const text = (value: string | null) => value?.trim() || undefined

/** Unknown or bad values fall back to the defaults, so any URL opens. */
export function readLabState(params: URLSearchParams): LabState {
    const state: LabState = {
        source: oneOf(
            params.get('source'),
            ['fixture', 'live'],
            DEFAULTS.source
        ),
        scenario: oneOf(
            params.get('scenario'),
            SCENARIO_IDS,
            DEFAULTS.scenario
        ),
        size: clamp(params.get('size'), 10, 1000) ?? DEFAULTS.size,
        cap: clamp(params.get('cap'), 10, 2000) ?? DEFAULTS.cap,
        layout: oneOf(params.get('layout'), ['web', 'trace'], DEFAULTS.layout),
    }
    const hops = clamp(params.get('hops'), 1, 6)
    if (hops !== undefined) state.hops = hops
    for (const key of ['seed', 'te', 'program', 'orgUnit'] as const) {
        const value = text(params.get(key))
        if (value !== undefined) state[key] = value
    }
    return state
}

const ORDER = [
    'source',
    'scenario',
    'size',
    'seed',
    'te',
    'program',
    'orgUnit',
    'hops',
    'cap',
    'layout',
] as const satisfies readonly (keyof LabState)[]

/** Omits defaults, so a plain lab has a plain URL; keys keep one order. */
export function writeLabState(state: LabState): URLSearchParams {
    const params = new URLSearchParams()
    for (const key of ORDER) {
        const value = state[key]
        if (value !== undefined && value !== DEFAULTS_BY_KEY.get(key)) {
            params.set(key, String(value))
        }
    }
    return params
}
