import { useCallback, useEffect, useMemo, useRef } from 'react'
import {
    emptyEffects,
    overlay,
    settleRules,
    useProgramRuleContext,
    useProgramRuleEvaluator,
} from '@/components/program-rules'
import type {
    RuleDependencyGraph,
    RuleEffects,
    RuleEventInput,
    RuleOutcome,
    RuleOutsideRead,
    RuleSettled,
} from '@/components/program-rules'
import type { StageForm, Values } from '../lib/metadata'

declare const process: { env: { NODE_ENV?: string } }

/** Within the rule evaluator's eight cached results. */
export const MAX_RUNS = 4

interface FormRulesOptions {
    programId: string
    programStageId: string
    enrollmentId?: string
    form: StageForm
    entered: Values
    event: RuleEvent
}

/** The event the rules run for, without its stage and values. */
type RuleEvent = Omit<RuleEventInput, 'programStageId' | 'dataValues'>

interface Rules {
    status: 'loading' | 'ready' | 'error'
    outcome?: RuleOutcome
    effects?: RuleEffects
    graph?: RuleDependencyGraph
    /** The rules kept changing the values and were stopped. */
    capped?: boolean
}

export interface FormRules extends Rules {
    /** What the rules read outside the form, by attribute or data element id. */
    outside?: ReadonlyMap<string, RuleOutsideRead>
    /** The rules for other values than the rendered ones: a commit made in the same event as a save. */
    rulesFor(entered: Values, event: RuleEvent): Rules
}

/** The rules' outcome for what was entered, once its values settle; editable at once for a stage without rules. */
export const useFormRules = ({
    programId,
    programStageId,
    enrollmentId,
    form,
    entered,
    event,
}: FormRulesOptions) => {
    const evaluator = useProgramRuleEvaluator({
        programId,
        programStageId,
        enrollmentId,
    })
    const context = useProgramRuleContext({ programId, programStageId })
    const { evaluate, outsideReads, graph, optionGroupOptions, invalidRules } =
        evaluator
    const ruleContext = context.context
    const noRules = context.metadata?.rules.length === 0
    const error = evaluator.error ?? context.error
    const { id, occurredAt, orgUnitId, status } = event

    const last = useRef<{ evaluate: typeof evaluate; settled: RuleSettled }>()
    const rulesFor = useCallback(
        (entered: Values, event: RuleEvent) => {
            if (error !== undefined) {
                return { status: 'error' } satisfies Rules
            }
            if (evaluate === undefined || ruleContext === undefined) {
                return (
                    noRules
                        ? {
                              status: 'ready',
                              effects: emptyEffects(),
                              outcome: overlay(
                                  entered,
                                  emptyEffects(),
                                  form,
                                  optionGroupOptions
                              ),
                          }
                        : { status: 'loading' }
                ) satisfies Rules
            }
            const run = settleRules(
                last.current?.evaluate === evaluate
                    ? last.current.settled
                    : undefined,
                entered,
                { ...event, programStageId },
                {
                    context: ruleContext,
                    evaluate,
                    form,
                    optionGroups: optionGroupOptions,
                    maxRuns: MAX_RUNS,
                }
            )
            if (run.isErr()) {
                return { status: 'error' } satisfies Rules
            }
            last.current = { evaluate, settled: run.value }
            const { effects, outcome, capped } = run.value
            return {
                status: 'ready',
                graph,
                effects,
                outcome,
                capped,
            } satisfies Rules
        },
        [
            error,
            evaluate,
            ruleContext,
            noRules,
            form,
            optionGroupOptions,
            graph,
            programStageId,
        ]
    )
    const rules = useMemo(
        () => rulesFor(entered, { id, occurredAt, orgUnitId, status }),
        [rulesFor, entered, id, occurredAt, orgUnitId, status]
    )
    const outside = useMemo(
        () =>
            outsideReads?.({
                id,
                occurredAt,
                orgUnitId,
                status,
                programStageId,
                dataValues: {},
            }),
        [outsideReads, id, occurredAt, orgUnitId, status, programStageId]
    )

    const warned = useRef(false)
    useEffect(() => {
        if (
            process.env.NODE_ENV === 'production' ||
            warned.current ||
            invalidRules.length === 0
        ) {
            return
        }
        warned.current = true
        console.warn(
            `event-form: these program rules cannot run and are left out:\n${invalidRules
                .map(({ ruleName, message }) => `${ruleName}: ${message}`)
                .join('\n')}`
        )
    }, [invalidRules])

    const warnedCap = useRef(false)
    useEffect(() => {
        if (
            process.env.NODE_ENV === 'production' ||
            warnedCap.current ||
            !rules.capped
        ) {
            return
        }
        warnedCap.current = true
        console.warn(
            `event-form: the program rules kept changing the values after ${MAX_RUNS} runs, so the form shows the last run; look for rules that hide or set each other's fields.`
        )
    }, [rules.capped])

    return { ...rules, outside, rulesFor } satisfies FormRules
}
