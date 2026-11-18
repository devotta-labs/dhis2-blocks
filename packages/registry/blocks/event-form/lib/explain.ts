import i18n from '@dhis2/d2-i18n'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import { languageTags } from '@/components/dhis2-value-types'
import type { ValueSettings } from '@/components/dhis2-value-types'
import { fieldDisplay } from '@/components/program-rules'
import type {
    Blame,
    BlameContext,
    RuleOutcome,
    RuleReason,
} from '@/components/program-rules'

// Rule names, labels and values are text, not HTML.
const AS_IS = { escapeValue: false }
const SHOWN_REASONS = 3

/** How the form shows a value in its explanations: in the system's calendar, an org unit by its name. */
export const displayWith =
    (
        settings: ValueSettings,
        /** Stored id → name, for org unit values. */
        names: ReadonlyMap<string, string>
    ): BlameContext['display'] =>
    (value, { valueType, options }) =>
        formatDhis2Value(
            value,
            {
                valueType,
                optionSet: options && {
                    options: options.map(({ code, name }) => ({
                        code,
                        displayName: name,
                    })),
                },
            },
            { calendar: settings.calendar, orgUnitNames: names }
        )

/** What names an answer a rule read: its label, and where it came from when that is outside the form. */
export const reasonLabel = ({ label, from }: RuleReason): string => {
    const options = { label, interpolation: AS_IS }
    if (from === undefined) {
        return label
    }
    if (from.kind === 'enrollment') {
        return i18n.t('{{label}} (from the enrolment)', options)
    }
    if (from.previous) {
        return i18n.t('{{label}} (previous event)', options)
    }
    return from.stage === undefined
        ? i18n.t('{{label}} (another event)', options)
        : i18n.t('{{label}} ({{stage}})', { ...options, stage: from.stage })
}

const listOf = (items: string[]) =>
    new Intl.ListFormat(languageTags(), { type: 'conjunction' }).format(items)

const reasonsOf = (because: Blame['because']) => {
    const reasons = because.slice(0, SHOWN_REASONS).map((reason) => {
        const { value } = reason
        const label = reasonLabel(reason)
        return value === undefined
            ? i18n.t('{{label}} is not answered', {
                  label,
                  interpolation: AS_IS,
              })
            : i18n.t('{{label}} is {{value}}', {
                  label,
                  value,
                  interpolation: AS_IS,
              })
    })
    const more = because.length - SHOWN_REASONS
    return listOf(
        more > 0
            ? [...reasons, i18n.t('{{count}} more', { count: more })]
            : reasons
    )
}

const ruleSentence = (blame: Blame, label: string) => {
    const rule = blame.ruleName
    const options = { rule, label, interpolation: AS_IS }
    switch (blame.effect) {
        case 'assigned':
            return blame.value === undefined
                ? i18n.t('Cleared by rule "{{rule}}"', options)
                : i18n.t('Set by rule "{{rule}}"', options)
        case 'required':
            return i18n.t('Required by rule "{{rule}}"', options)
        case 'options':
            return i18n.t('Some options removed by rule "{{rule}}"', options)
        case 'message':
            return i18n.t('Said by rule "{{rule}}"', options)
        case 'hidden':
        case 'sectionHidden':
            return i18n.t('{{label}}: hidden by rule "{{rule}}"', {
                ...options,
                nsSeparator: '::',
            })
    }
}

/** One blame of the field or section labelled `label` in a sentence: a set field's description, a hidden question's line. */
export const blameLine = (blame: Blame, label: string): string => {
    const sentence =
        blame.because.length === 0
            ? ruleSentence(blame, label)
            : i18n.t('{{sentence}} because {{reasons}}', {
                  sentence: ruleSentence(blame, label),
                  reasons: reasonsOf(blame.because),
                  interpolation: AS_IS,
              })
    const hidden = blame.effect === 'hidden' || blame.effect === 'sectionHidden'
    if (!hidden || blame.value === undefined) {
        return sentence
    }
    const options = { sentence, value: blame.value, interpolation: AS_IS }
    return blame.stored
        ? i18n.t(
              '{{sentence}}. Your answer "{{value}}" will be removed when you save.',
              options
          )
        : i18n.t(
              '{{sentence}}. Your answer "{{value}}" is not saved while it is hidden.',
              options
          )
}

const leadOf = (blame: Blame) => {
    const options = { value: blame.value, interpolation: AS_IS }
    switch (blame.effect) {
        case 'assigned':
            return blame.value === undefined
                ? i18n.t('Cleared')
                : i18n.t('Set to {{value}}', options)
        case 'required':
            return i18n.t('Required')
        case 'options':
            return i18n.t('Some options removed')
        case 'message':
            return blame.value ?? ''
        case 'hidden':
        case 'sectionHidden':
            return i18n.t('Hidden')
    }
}

/** What one blame did and why, in the reader's words, as an explanation opens with: `Set to 300 because Weight (kg) is 150.` */
export const blameLead = (blame: Blame): string =>
    blame.because.length === 0
        ? leadOf(blame)
        : i18n.t('{{lead}} because {{reasons}}.', {
              lead: leadOf(blame),
              reasons: reasonsOf(blame.because),
              interpolation: AS_IS,
          })

/**
 * The words a field's marker says of its blames, by the main one: set, required or fewer options. None for messages
 * alone, which say themselves under the field.
 */
export const markerOf = (blames: readonly Blame[]): string | undefined => {
    const has = (effect: Blame['effect']) =>
        blames.some((blame) => blame.effect === effect)
    if (has('assigned')) {
        return i18n.t('Set automatically')
    }
    if (has('required')) {
        return i18n.t('Required here')
    }
    return has('options') ? i18n.t('Fewer options') : undefined
}

/** What the rules changed between two outcomes, for an announcement; `''` when nothing changed. */
export const ruleChanges = (
    before: RuleOutcome,
    after: RuleOutcome,
    context: BlameContext
): string =>
    [...context.form.fields.values()]
        .flatMap(({ id, label }) => {
            const options = { label, interpolation: AS_IS }
            if (after.hidden.has(id) !== before.hidden.has(id)) {
                return after.hidden.has(id)
                    ? i18n.t('{{label}} hidden.', options)
                    : i18n.t('{{label}} shown.', options)
            }
            if (after.hidden.has(id)) {
                return []
            }
            const said: string[] = []
            if (after.required.has(id) !== before.required.has(id)) {
                said.push(
                    after.required.has(id)
                        ? i18n.t('{{label}} required.', options)
                        : i18n.t('{{label}} not required.', options)
                )
            }
            const assigned = after.assigned.get(id)
            if (
                assigned !== undefined &&
                assigned.value !== before.effective[id]
            ) {
                said.push(
                    assigned.value === undefined
                        ? i18n.t('{{label}} cleared.', options)
                        : i18n.t('{{label}} set to {{value}}.', {
                              ...options,
                              value: fieldDisplay(id, assigned.value, context),
                          })
                )
            }
            return said
        })
        .join(' ')
