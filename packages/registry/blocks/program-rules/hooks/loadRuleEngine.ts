import { useEffect, useState } from 'react'
import type { RuleEngineModule } from '../lib'

/** Where the engine's chunk comes from; tests make the import fail. */
export const ruleEngineChunk = {
    load: (): Promise<RuleEngineModule> => import('@dhis2/rule-engine'),
}

let pending: Promise<RuleEngineModule> | undefined
let loaded: RuleEngineModule | undefined

/**
 * Loads `@dhis2/rule-engine` once per app. The engine is a large chunk, so it
 * is only imported on first use; call this early to preload it. A failed
 * import is forgotten, so the next call tries again.
 */
export const loadRuleEngine = (): Promise<RuleEngineModule> => {
    pending ??= ruleEngineChunk.load().then(
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
 * can't be serialised, so a persisted cache would restore it as `{}`. A failed
 * import is tried again by the next mount, and when the connection comes back.
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
        const load = () =>
            loadRuleEngine().then(
                (engine) => live && setState({ engine }),
                (error: Error) => live && setState({ error })
            )
        void load()
        window.addEventListener('online', load)
        return () => {
            live = false
            window.removeEventListener('online', load)
        }
    }, [enabled, state.engine])
    return state
}
