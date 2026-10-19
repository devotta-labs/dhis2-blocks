import {
    buildRuleContext,
    evaluateEventRules,
    type ProgramRulesMetadata,
    type RuleEffects,
} from '@/lib/program-rules'
import { loadRuleEngine, useProgramRules } from '@/hooks/use-program-rules'

// Type-level use only: the check compiles and bundles this file, never runs it.
export const evaluate = async (
    metadata: ProgramRulesMetadata
): Promise<RuleEffects> => {
    const engine = await loadRuleEngine()
    return evaluateEventRules(engine, buildRuleContext(engine, metadata), {
        event: {
            id: 'event',
            programStageId: 'stage',
            orgUnitId: 'orgUnit',
            status: 'ACTIVE',
            dataValues: {},
        },
        otherEvents: [],
    })
}

export const useRules = () =>
    useProgramRules({
        programId: 'program',
        programStageId: 'stage',
        input: {
            event: {
                id: 'event',
                programStageId: 'stage',
                orgUnitId: 'orgUnit',
                status: 'ACTIVE',
                dataValues: {},
            },
        },
    })
