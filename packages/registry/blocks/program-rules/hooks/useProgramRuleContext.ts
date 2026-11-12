import { Result } from 'better-result'
import { useMemo } from 'react'
import {
    buildRuleContext,
    metadataForStage,
    type ProgramRulesMetadata,
    type RuleContext,
    type RuleEngineModule,
    type RuleOrgUnitGroupMetadata,
} from '../lib'
import { useRuleEngine } from './loadRuleEngine'
import { useOrgUnitGroupsQuery, useRuleMetadataQuery } from './queries'

export interface UseProgramRuleContextOptions {
    programId: string
    programStageId: string
    enabled?: boolean
}

export interface UseProgramRuleContextResult {
    status: 'loading' | 'ready' | 'error'
    /** The program's rule metadata, rules limited to this stage. */
    metadata?: ProgramRulesMetadata
    /** Built from `metadata`, ready to evaluate: graph, invalid rules, requirements. */
    context?: RuleContext
    error?: Error
}

const NO_GROUPS: string[] = []

export const asError = (cause: unknown): Error =>
    cause instanceof Error ? cause : new Error(String(cause))

const buildContext = (
    engine: RuleEngineModule | undefined,
    metadata: ProgramRulesMetadata | undefined,
    orgUnitGroups?: ReadonlyArray<RuleOrgUnitGroupMetadata>
) =>
    engine === undefined || metadata === undefined
        ? undefined
        : Result.try({
              try: () =>
                  buildRuleContext(
                      engine,
                      orgUnitGroups === undefined
                          ? metadata
                          : { ...metadata, orgUnitGroups }
                  ),
              catch: asError,
          })

const okContext = (built: ReturnType<typeof buildContext>) =>
    built?.isOk() ? built.value : undefined

/** A query only fails while it is needed and has nothing to show. */
export const neededFailure = (
    query: { data?: unknown; error: Error | null },
    needed: boolean
) =>
    needed && query.data === undefined ? (query.error ?? undefined) : undefined

interface StageRuleContext {
    engine?: RuleEngineModule
    metadata?: ProgramRulesMetadata
    context?: RuleContext
    error?: Error
}

/** The engine, the stage's metadata and its context; shared with `useProgramRules`. */
export const useStageRuleContext = ({
    programId,
    programStageId,
    enabled = true,
}: UseProgramRuleContextOptions): StageRuleContext => {
    const ruleEngine = useRuleEngine(enabled)
    const metadataQuery = useRuleMetadataQuery(programId, enabled)
    const engine = ruleEngine.engine

    const metadata = useMemo(
        () =>
            metadataQuery.data &&
            metadataForStage(metadataQuery.data, programStageId),
        [metadataQuery.data, programStageId]
    )

    const baseContext = useMemo(
        () => buildContext(engine, metadata),
        [engine, metadata]
    )
    const groups =
        okContext(baseContext)?.requirements.orgUnitGroups ?? NO_GROUPS
    const groupsQuery = useOrgUnitGroupsQuery(groups, enabled)
    const groupedContext = useMemo(
        () =>
            groupsQuery.data === undefined
                ? undefined
                : buildContext(engine, metadata, groupsQuery.data),
        [engine, metadata, groupsQuery.data]
    )
    const builtContext = groups.length > 0 ? groupedContext : baseContext

    const error =
        ruleEngine.error ??
        neededFailure(metadataQuery, true) ??
        neededFailure(groupsQuery, groups.length > 0) ??
        (builtContext?.isErr() ? builtContext.error : undefined)

    return {
        engine,
        metadata,
        context: okContext(builtContext),
        error,
    }
}

/**
 * The rule context for a program stage, without an event: the dependency
 * graph, invalid rules and data requirements, and the metadata it was built
 * from. Shares its queries and the engine with `useProgramRules`.
 */
export const useProgramRuleContext = (
    options: UseProgramRuleContextOptions
): UseProgramRuleContextResult => {
    const { metadata, context, error } = useStageRuleContext(options)
    const progress = context === undefined ? 'loading' : 'ready'
    return {
        status: error === undefined ? progress : 'error',
        metadata,
        context,
        error,
    }
}
