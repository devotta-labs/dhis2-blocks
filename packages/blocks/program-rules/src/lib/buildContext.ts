import type {
    ProgramRulesMetadata,
    RuleContext,
    RuleEngineModule,
} from './types'

export const buildRuleContext = (
    engine: RuleEngineModule,
    metadata: ProgramRulesMetadata
): RuleContext => {
    throw new Error(`not implemented: ${metadata.programId} ${String(engine)}`)
}
