import i18n from '@dhis2/d2-i18n'
import { storedDay } from '@/components/dhis2-value-display'
import type { Dhis2Calendar } from '@/components/dhis2-value-display'
import { todayIso } from '@/components/dhis2-value-types'
import { EVENT_DATE } from '@/components/program-rules'
import type {
    RuleEventStatus,
    RuleMessage,
    RuleOutcome,
} from '@/components/program-rules'
import { choiceProblem } from './categories'
import type { FormField, StageForm, Values } from './metadata'

export type Attempt = 'save' | 'complete'

/** `fieldId` is `EVENT_DATE` for the event date, `LOCATION` for the location, and a category's id for a category. */
interface Invalid {
    fieldId: string
    text: string
}

export interface Validation {
    invalid: readonly Invalid[]
    formErrors: readonly string[]
    warningsOnComplete: readonly string[]
}

export interface ValidationInput {
    form: StageForm
    outcome: RuleOutcome
    /** Field, `EVENT_DATE` or `LOCATION` → the problem `ValueInput` reported. */
    problems: ReadonlyMap<string, string>
    eventDate: string | undefined
    status: RuleEventStatus
    /** Category id → the option chosen. */
    categories: Values
    /** The form's org unit and its ancestors. */
    orgUnits: ReadonlySet<string>
    calendar: Dhis2Calendar
}

export { EVENT_DATE }
export const LOCATION = 'geometry'

const textsOf = (
    messages: readonly RuleMessage[] | undefined,
    kind: RuleMessage['kind']
) =>
    (messages ?? [])
        .filter((message) => message.kind === kind)
        .map(({ text }) => text)

const DATED = new Set(['DATE', 'DATETIME'])

/**
 * Why a stored date or date and time cannot be the field's: its day is after `today` where the stage does not allow
 * future dates. Stored days are ISO in any calendar, so they compare as text.
 */
export const futureProblem = (
    field: FormField,
    value: string | undefined,
    today = todayIso()
) => {
    const day = value === undefined ? undefined : storedDay(value)
    return !field.allowFutureDate &&
        DATED.has(field.field.valueType) &&
        day !== undefined &&
        day > today
        ? i18n.t('A date in the future is not allowed')
        : undefined
}

/** The fields on screen: in a section and not hidden by the rules. */
export const shownFields = (form: StageForm, outcome: RuleOutcome) =>
    form.sections
        .flatMap(({ fieldIds }) => fieldIds)
        .filter((fieldId) => !outcome.hidden.has(fieldId))

/**
 * What blocks an attempt. The event date, the categories (DHIS2 refuses an event without them), a location typed that
 * is not one, and value problems (a future date where the stage refuses one among them) always do, except on a field a
 * rule sets, which cannot be changed; the rest only where the stage's strategy checks this attempt.
 * Saving a completed event checks as completing it, as what is saved is a completed event.
 */
export const validate = (
    {
        form,
        outcome,
        problems,
        eventDate,
        status,
        categories,
        orgUnits,
        calendar,
    }: ValidationInput,
    attempt: Attempt
): Validation => {
    const completing = attempt === 'complete' || status === 'COMPLETED'
    const checksAll =
        completing || form.validationStrategy === 'ON_UPDATE_AND_INSERT'
    const required = i18n.t('Required')

    const dateProblem = problems.get(EVENT_DATE)
    const invalid: Invalid[] = []
    if (dateProblem !== undefined) {
        invalid.push({ fieldId: EVENT_DATE, text: dateProblem })
    } else if (!eventDate) {
        invalid.push({ fieldId: EVENT_DATE, text: required })
    }
    for (const category of form.categories) {
        const chosen = categories[category.id]
        const text =
            problems.get(category.id) ??
            (chosen === undefined
                ? required
                : choiceProblem(category, chosen, {
                      orgUnits,
                      eventDate,
                      calendar,
                  }))
        if (text !== undefined) {
            invalid.push({ fieldId: category.id, text })
        }
    }
    // Not required: only a location that is not one yet holds the attempt back.
    const locationProblem = problems.get(LOCATION)
    if (locationProblem !== undefined) {
        invalid.push({ fieldId: LOCATION, text: locationProblem })
    }

    const shown = shownFields(form, outcome)
    for (const fieldId of shown) {
        const messages = outcome.messages.get(fieldId)
        const field = form.fields.get(fieldId)
        const text =
            (outcome.assigned.has(fieldId)
                ? undefined
                : (problems.get(fieldId) ??
                  (field &&
                      futureProblem(field, outcome.effective[fieldId])))) ??
            (checksAll &&
            outcome.required.has(fieldId) &&
            !outcome.effective[fieldId]
                ? required
                : undefined) ??
            (checksAll ? textsOf(messages, 'error')[0] : undefined) ??
            (completing ? textsOf(messages, 'errorOnComplete')[0] : undefined)
        if (text !== undefined) {
            invalid.push({ fieldId, text })
        }
    }

    const formMessages = outcome.messages.get('form')
    const label = (fieldId: string) => form.fields.get(fieldId)?.label ?? ''
    return {
        invalid,
        formErrors: [
            ...(checksAll ? textsOf(formMessages, 'error') : []),
            ...(completing ? textsOf(formMessages, 'errorOnComplete') : []),
        ],
        warningsOnComplete: [
            ...shown.flatMap((fieldId) =>
                textsOf(outcome.messages.get(fieldId), 'warningOnComplete').map(
                    (text) =>
                        i18n.t('{{label}}: {{text}}', {
                            label: label(fieldId),
                            text,
                            nsSeparator: '::',
                            interpolation: { escapeValue: false },
                        })
                )
            ),
            ...textsOf(formMessages, 'warningOnComplete'),
        ],
    }
}
