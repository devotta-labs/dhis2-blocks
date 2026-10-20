export { loadRuleEngine } from './hooks/loadRuleEngine'
export { programRulesQueryKeys } from './hooks/queryKeys'
export { useProgramRuleContext } from './hooks/useProgramRuleContext'
export type {
    UseProgramRuleContextOptions,
    UseProgramRuleContextResult,
} from './hooks/useProgramRuleContext'
export { useProgramRuleEvaluator } from './hooks/useProgramRuleEvaluator'
export type {
    RuleEvaluation,
    UseProgramRuleEvaluatorOptions,
    UseProgramRuleEvaluatorResult,
} from './hooks/useProgramRuleEvaluator'
export { useProgramRules } from './hooks/useProgramRules'
export type {
    ProgramRulesInput,
    ProgramRulesStatus,
    UseProgramRulesOptions,
    UseProgramRulesResult,
} from './hooks/useProgramRules'
// The lib types and helpers a consumer of the hook reads. Re-exported here
// because the shadcn installer rewrites registry imports by file name, and the
// lib's `index.ts` shares its name with every other item's entry file.
export { explainField } from './lib/evaluate'
export type {
    Attribution,
    InvalidRule,
    ProgramRulesMetadata,
    RuleContext,
    RuleDependencyGraph,
    RuleEffects,
    RuleEnrollmentInput,
    RuleEventInput,
    RuleMessage,
} from './lib/types'
