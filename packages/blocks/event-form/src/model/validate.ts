import type { RuleMessage } from '@/registry/program-rules/index'
import type { StageMetadata } from '../api/schemas'
import type { FormModel } from './buildFormModel'

type ValidationStrategy = StageMetadata['stage']['validationStrategy']

interface ValidationResult {
    isValid: boolean
    failedFieldIds: string[]
    /** Rule messages about the whole event that block, by the same rules as a field's. */
    formErrors: RuleMessage[]
}

/**
 * Which fields block saving or completing, honouring the stage's validation strategy:
 * - NONE checks type errors only;
 * - ON_COMPLETE checks everything, but only when completing;
 * - ON_UPDATE_AND_INSERT always checks everything.
 * Everything is value-type errors, rule errors, rule errors-on-complete (when completing) and
 * empty required fields, whether required by metadata or by a rule. Hidden fields are skipped.
 * A required unsupported field that is empty cannot be answered in this form, so it blocks
 * completing under every strategy. Rule messages about the whole event block exactly as a field's
 * rule messages do: an error on a full check, an error-on-complete on a full check when completing.
 */
export const validateForm = (
    model: FormModel,
    options: { strategy: ValidationStrategy; isCompleting: boolean }
): ValidationResult => {
    const { strategy, isCompleting } = options
    const fullCheck =
        strategy === 'ON_UPDATE_AND_INSERT' ||
        (strategy === 'ON_COMPLETE' && isCompleting)
    const failedFieldIds: string[] = []
    for (const [id, field] of model.fields) {
        if (field.hidden) {
            continue
        }
        const empty = field.value === undefined
        const failed =
            field.messages.error !== undefined ||
            (isCompleting && field.unsupported && field.required && empty) ||
            (fullCheck &&
                (field.messages.ruleErrors.length > 0 ||
                    (isCompleting &&
                        field.messages.errorOnComplete !== undefined) ||
                    (field.required && empty)))
        if (failed) {
            failedFieldIds.push(id)
        }
    }
    const formErrors = fullCheck
        ? model.formMessages.filter(
              (message) =>
                  message.kind === 'error' ||
                  (isCompleting && message.kind === 'errorOnComplete')
          )
        : []
    return {
        isValid: failedFieldIds.length === 0 && formErrors.length === 0,
        failedFieldIds,
        formErrors,
    }
}
