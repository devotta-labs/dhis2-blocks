import { useMemo, useRef } from 'react'
import { useStore } from 'zustand'
import {
    useProgramRules,
    type UseProgramRulesResult,
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

const statusOf = (
    first: UseProgramRulesResult,
    second: UseProgramRulesResult
): UseProgramRulesResult['status'] =>
    first.status === 'error' || second.status === 'error'
        ? 'error'
        : second.status

/**
 * Rule effects, the overlay and the form model, all derived from the store's committed state.
 *
 * Rules run twice per change. The first pass reads the stored values; the second reads those
 * values with the first pass's effects laid over them, so a rule that reads a field another rule
 * hides sees it empty, as it will be once saved. Two passes, never more: a rule that hides the
 * field it reads cannot loop. Each pass memoises on the content of its input, so a commit that
 * leaves the values as they were evaluates nothing.
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

    const ruleEvent = (values: Values) =>
        toRuleEvent({
            eventId,
            programStageId,
            scheduledAt,
            values,
            context,
            status,
        })
    const firstInput = { event: ruleEvent(stored) }
    const first = useProgramRules({
        programId,
        programStageId,
        enrollmentId,
        input: firstInput,
    })
    const firstEffective = useMemo(
        () => overlay(stored, first.effects).effective,
        [stored, first.effects]
    )
    const second = useProgramRules({
        programId,
        programStageId,
        enrollmentId,
        input: { event: ruleEvent(firstEffective) },
    })
    const effects = second.effects

    const { effective, ruleChanges } = useMemo(
        () => overlay(stored, effects),
        [stored, effects]
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
            optionGroupOptions: second.optionGroupOptions,
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
        second.optionGroupOptions,
        fieldErrors,
        attempt,
    ])

    const rulesStatus = statusOf(first, second)
    const error = first.error ?? second.error
    const rules = useMemo<EventFormRules>(
        () => ({
            status: rulesStatus,
            ...(effects !== undefined && { effects }),
            ruleChanges,
            invalidRules: second.invalidRules,
            explain: second.explain,
            ...(second.graph !== undefined && { graph: second.graph }),
            ...(error !== undefined && { error }),
        }),
        [
            rulesStatus,
            effects,
            ruleChanges,
            second.invalidRules,
            second.explain,
            second.graph,
            error,
        ]
    )

    return { model, effective, ruleChanges, rules }
}
