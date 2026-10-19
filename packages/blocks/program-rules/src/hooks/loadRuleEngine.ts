import type { RuleEngineModule } from '../index'

let pending: Promise<RuleEngineModule> | undefined

/**
 * Loads `@dhis2/rule-engine` once per app. The engine is a large chunk, so it
 * is only imported on first use; call this early to preload it.
 */
export const loadRuleEngine = (): Promise<RuleEngineModule> => {
    pending ??= import('@dhis2/rule-engine').catch((error: Error) => {
        pending = undefined
        throw error
    })
    return pending
}
