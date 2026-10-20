import { useCallback, useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import {
    explainField,
    useProgramRuleEvaluator,
} from '@/registry/program-rules/use-program-rules'
import type { StageMetadata } from '../../api/schemas'
import {
    buildFormModel,
    type BuildFormModelInput,
    type FormModel,
} from '../../model/buildFormModel'
import { overlay, type RuleChange, type Values } from '../../model/overlay'
import { getValueTypeSpec, type ValueError } from '../../model/valueTypes'
import type { EventFormStore } from '../../state/store'
import type { EventFormRules } from './EventFormContext'
import { toRuleEvent } from './initialState'

interface ModelArgs {
    store: EventFormStore
    metadata: StageMetadata
    programId: string
    programStageId: string
    enrollmentId: string
    scheduledAt: string | undefined
}

interface EventFormModelResult {
    model: FormModel
    effective: Values
    ruleChanges: RuleChange[]
    rules: EventFormRules
}

/** Value-type errors of the effective values, with the server's errors on top. */
const fieldErrorsOf = (
    metadata: StageMetadata,
    effective: Values,
    serverErrors: Readonly<Record<string, string>>
): BuildFormModelInput['fieldErrors'] => {
    const errors: [string, ValueError][] = []
    for (const [id, value] of Object.entries(effective)) {
        const meta = metadata.dataElements.get(id)
        const error = meta && getValueTypeSpec(meta).validate(value)
        if (error) {
            errors.push([id, error])
        }
    }
    for (const [id, message] of Object.entries(serverErrors)) {
        errors.push([id, { code: 'server', message }])
    }
    // A later entry wins, so a server error replaces a value-type error.
    return Object.fromEntries(errors)
}

/**
 * Rule effects, the overlay and the form model, all derived from the store's committed state.
 *
 * Rules run twice per change. The first pass reads the stored values; the second reads those
 * values with the first pass's effects laid over them, so a rule that reads a field another rule
 * hides sees it empty, as it will be once saved. Two passes, never more: a rule that hides the
 * field it reads cannot loop. Both passes run against one rule context, and the evaluator returns
 * the same result for the same event content, so a commit that leaves the values as they were
 * evaluates nothing.
 */
export const useEventFormModel = ({
    store,
    metadata,
    programId,
    programStageId,
    enrollmentId,
    scheduledAt,
}: ModelArgs): EventFormModelResult => {
    const eventId = useStore(store, (state) => state.eventId)
    const stored = useStore(store, (state) => state.stored)
    const context = useStore(store, (state) => state.context)
    const status = useStore(store, (state) => state.status)
    const attempt = useStore(store, (state) => state.attempt)
    const serverErrors = useStore(store, (state) => state.fieldErrors)

    const evaluator = useProgramRuleEvaluator({
        programId,
        programStageId,
        enrollmentId,
    })
    const evaluate = (values: Values) =>
        evaluator.evaluate?.(
            toRuleEvent({
                eventId,
                programStageId,
                scheduledAt,
                values,
                context,
                status,
            })
        )
    const first = evaluate(stored)
    const firstEffects = first?.isOk() ? first.value : undefined
    const firstEffective = useMemo(
        () => overlay(stored, firstEffects, metadata.dataElements).effective,
        [stored, firstEffects, metadata.dataElements]
    )
    // Without the first pass's effects there is nothing to lay over, so no second pass.
    const second =
        firstEffects === undefined ? undefined : evaluate(firstEffective)
    const effects = second?.isOk() ? second.value : undefined
    const evaluationError = first?.isErr()
        ? first.error
        : second?.isErr()
          ? second.error
          : undefined
    const error = evaluator.error ?? evaluationError

    const { effective, ruleChanges } = useMemo(
        () => overlay(stored, effects, metadata.dataElements),
        [stored, effects, metadata.dataElements]
    )
    const fieldErrors = useMemo(
        () => fieldErrorsOf(metadata, effective, serverErrors),
        [metadata, effective, serverErrors]
    )

    const previous = useRef<FormModel | undefined>(undefined)
    const model = useMemo(() => {
        const next = buildFormModel(previous.current, {
            metadata,
            effective,
            stored,
            effects,
            optionGroupOptions: evaluator.optionGroupOptions,
            fieldErrors,
            showAllErrors: attempt !== 'none',
            isCompleting: attempt === 'complete',
        })
        previous.current = next
        return next
    }, [
        metadata,
        effective,
        stored,
        effects,
        evaluator.optionGroupOptions,
        fieldErrors,
        attempt,
    ])

    const explain = useCallback(
        (fieldId: string) =>
            effects === undefined ? [] : explainField(effects, fieldId),
        [effects]
    )
    const rulesStatus =
        error !== undefined
            ? 'error'
            : effects === undefined
              ? 'loading'
              : 'ready'
    const rules = useMemo<EventFormRules>(
        () => ({
            status: rulesStatus,
            ...(effects !== undefined && { effects }),
            ruleChanges,
            invalidRules: evaluator.invalidRules,
            explain,
            ...(evaluator.graph !== undefined && { graph: evaluator.graph }),
            ...(error !== undefined && { error }),
        }),
        [
            rulesStatus,
            effects,
            ruleChanges,
            evaluator.invalidRules,
            explain,
            evaluator.graph,
            error,
        ]
    )

    return { model, effective, ruleChanges, rules }
}
