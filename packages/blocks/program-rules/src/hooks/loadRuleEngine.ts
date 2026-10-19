import { useEffect, useState } from 'react'
import type { RuleEngineModule } from '../index'

let pending: Promise<RuleEngineModule> | undefined
let loaded: RuleEngineModule | undefined

/**
 * Loads `@dhis2/rule-engine` once per app. The engine is a large chunk, so it
 * is only imported on first use; call this early to preload it.
 */
export const loadRuleEngine = (): Promise<RuleEngineModule> => {
    pending ??= import('@dhis2/rule-engine').then(
        (engine) => {
            loaded = engine
            return engine
        },
        (error: Error) => {
            pending = undefined
            throw error
        }
    )
    return pending
}

interface RuleEngineState {
    engine?: RuleEngineModule
    error?: Error
}

/**
 * The engine module, kept out of React Query's cache on purpose: a module
 * can't be serialised, so a persisted cache would restore it as `{}`.
 */
export const useRuleEngine = (enabled: boolean): RuleEngineState => {
    const [state, setState] = useState<RuleEngineState>(() => ({
        engine: loaded,
    }))
    useEffect(() => {
        if (!enabled || state.engine !== undefined) {
            return undefined
        }
        let live = true
        loadRuleEngine().then(
            (engine) => live && setState({ engine }),
            (error: Error) => live && setState({ error })
        )
        return () => {
            live = false
        }
    }, [enabled, state.engine])
    return state
}
