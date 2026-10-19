import type {
    Attribution,
    InvalidRule,
    RuleDependencyGraph,
    RuleEffects,
    RuleEnrollmentInput,
    RuleEventInput,
} from '@/registry/dhis2/lib/program-rules'

export interface ProgramRulesInput {
    event: RuleEventInput
    /** Pass it to skip fetching the enrollment. */
    enrollment?: RuleEnrollmentInput
    /** Pass them to skip fetching the enrollment's events. */
    otherEvents?: ReadonlyArray<RuleEventInput>
}

export interface UseProgramRulesOptions {
    programId: string
    programStageId: string
    enrollmentId?: string
    input: ProgramRulesInput
    enabled?: boolean
}

export type ProgramRulesStatus = 'loading' | 'ready' | 'error'

export interface UseProgramRulesResult {
    status: ProgramRulesStatus
    effects?: RuleEffects
    invalidRules: InvalidRule[]
    explain: (fieldId: string) => Attribution[]
    error?: Error
    graph?: RuleDependencyGraph
    /** optionGroupId → option codes, to resolve option group effects */
    optionGroupOptions: Map<string, Set<string>>
}

export const useProgramRules = (
    options: UseProgramRulesOptions
): UseProgramRulesResult => {
    throw new Error(`not implemented: ${options.programId}`)
}
