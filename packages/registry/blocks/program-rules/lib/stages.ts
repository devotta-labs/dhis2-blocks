import type { ProgramRulesMetadata } from './types'

/** The metadata with only the rules that apply to a stage: program-wide ones and the stage's own. */
export const metadataForStage = (
    metadata: ProgramRulesMetadata,
    programStageId: string
): ProgramRulesMetadata => ({
    ...metadata,
    rules: metadata.rules.filter(
        (rule) =>
            rule.programStageId === undefined ||
            rule.programStageId === programStageId
    ),
})
