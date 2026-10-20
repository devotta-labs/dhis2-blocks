import {
    useEventFormRules,
    useEventFormState,
    type Values,
} from '@dhis2-blocks/event-form'
import { Button } from '@dhis2-blocks/ui/button'
import React, { useEffect, useRef, useState } from 'react'
import i18n from '../../../i18n'
import {
    changedAnswers,
    diffEffects,
    effectMap,
    groupChanges,
    type ChangeGroup,
    type Effect,
} from './effects'
import { listOf, raw, RuleName, showValue, useLens } from './RulesLensContext'

interface FeedEntry {
    id: number
    /** Unset for the effects already in place when the lens opened. */
    answers?: { fieldId: string; value: string | undefined }[]
    groups: ChangeGroup[]
}

const MAX_ENTRIES = 30

/**
 * Each time the rule effects change, what changed and the answers that changed with them.
 * Effects are evaluated in the same render as the values they come from, so the answers that
 * changed since the last evaluation are its cause. Rule-assigned values are effects, not answers.
 */
const useRulesFeed = () => {
    const { effects } = useEventFormRules()
    const { values } = useEventFormState()
    const last = useRef<{ effects: Map<string, Effect>; values: Values }>()
    const nextId = useRef(0)
    const [feed, setFeed] = useState<FeedEntry[]>([])

    useEffect(() => {
        if (effects === undefined) {
            return
        }
        const current = effectMap(effects)
        const previous = last.current
        last.current = { effects: current, values }
        const changes = diffEffects(previous?.effects ?? new Map(), current)
        if (changes.length === 0) {
            return
        }
        // A value a rule assigns, or that comes back or goes with its field, is not an answer.
        const ruleDriven = new Set([
            ...effects.assignedValues.keys(),
            ...changes
                .filter(({ effect }) => effect.kind !== 'error')
                .filter(({ effect }) => effect.kind !== 'warning')
                .map(({ effect }) => effect.targetId),
        ])
        const answers =
            previous === undefined
                ? undefined
                : changedAnswers(previous.values, values, ruleDriven).map(
                      (fieldId) => ({ fieldId, value: values[fieldId] })
                  )
        const entry = {
            id: nextId.current++,
            answers,
            groups: groupChanges(changes),
        }
        setFeed((entries) => [entry, ...entries].slice(0, MAX_ENTRIES))
    }, [effects, values])

    return { feed, clear: () => setFeed([]) }
}

const useDescribe = () => {
    const { label, sectionName } = useLens()
    return (group: ChangeGroup) => {
        const targets = listOf(
            group.targetIds.map((id) =>
                group.kind === 'hiddenSection' ? sectionName(id) : label(id)
            )
        )
        const started = group.direction !== 'stopped'
        const values = { targets, interpolation: raw }
        switch (group.kind) {
            case 'hidden':
                return started
                    ? i18n.t('Hid {{targets}}', values)
                    : i18n.t('Showed {{targets}}', values)
            case 'hiddenSection':
                return started
                    ? i18n.t('Hid the section {{targets}}', values)
                    : i18n.t('Showed the section {{targets}}', values)
            case 'assigned':
                return started
                    ? i18n.t('Set {{targets}} to {{value}}', {
                          ...values,
                          value: showValue(group.detail),
                      })
                    : i18n.t('Stopped calculating {{targets}}', values)
            case 'mandatory':
                return started
                    ? i18n.t('Made {{targets}} required', values)
                    : i18n.t('Made {{targets}} optional', values)
            case 'error':
                return started
                    ? i18n.t('Error on {{targets}}: {{text}}', {
                          ...values,
                          text: group.detail,
                      })
                    : i18n.t('Cleared the error on {{targets}}', values)
            case 'warning':
                return started
                    ? i18n.t('Warning on {{targets}}: {{text}}', {
                          ...values,
                          text: group.detail,
                      })
                    : i18n.t('Cleared the warning on {{targets}}', values)
            case 'options':
                return started
                    ? i18n.t('Limited the options of {{targets}}', values)
                    : i18n.t('Restored the options of {{targets}}', values)
        }
    }
}

/**
 * What the program rules did after each answer, newest first, and the rules left out because
 * they do not parse. Render it inside `RulesLensProvider` while the lens is on.
 */
export const RulesLensFeed = () => {
    const { invalidRules } = useEventFormRules()
    const { label } = useLens()
    const { feed, clear } = useRulesFeed()
    const describe = useDescribe()
    return (
        <aside
            className="flex flex-col gap-3 rounded-dhis2-sm border border-dhis2-grey-300 bg-dhis2-grey-050 p-4 text-sm xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-auto"
            aria-labelledby="rules-lens-feed-title"
            data-testid="rules-lens-feed"
        >
            <div className="flex items-center justify-between gap-2">
                <h2
                    id="rules-lens-feed-title"
                    className="m-0 text-base font-medium"
                >
                    {i18n.t('What the rules did')}
                </h2>
                {feed.length > 0 ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={clear}
                    >
                        {i18n.t('Clear')}
                    </Button>
                ) : null}
            </div>
            {feed.length === 0 ? (
                <p className="m-0 text-dhis2-grey-700">
                    {i18n.t(
                        'Answer a question to see what the program rules do. Click a tag on a field to see why.'
                    )}
                </p>
            ) : (
                <ol className="m-0 flex list-none flex-col p-0">
                    {feed.map((entry) => (
                        <li
                            key={entry.id}
                            className="flex flex-col gap-1 border-b border-dhis2-grey-200 py-2 last:border-b-0"
                            data-testid="rules-lens-feed-entry"
                        >
                            <p className="m-0 font-medium text-dhis2-grey-900">
                                {entry.answers === undefined
                                    ? i18n.t('Already in effect')
                                    : entry.answers.length === 0
                                      ? i18n.t('Rules re-evaluated')
                                      : entry.answers
                                            .map(({ fieldId, value }) =>
                                                i18n.t(
                                                    '{{field}} set to {{value}}',
                                                    {
                                                        field: label(fieldId),
                                                        value: showValue(value),
                                                        interpolation: raw,
                                                    }
                                                )
                                            )
                                            .join(', ')}
                            </p>
                            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                                {entry.groups.map((group) => (
                                    <li
                                        key={`${group.kind}|${group.direction}|${group.ruleId}|${group.detail ?? ''}`}
                                        className="text-dhis2-grey-800"
                                    >
                                        <span aria-hidden="true">→ </span>
                                        {describe(group)}{' '}
                                        <RuleName>{group.ruleName}</RuleName>
                                    </li>
                                ))}
                            </ul>
                        </li>
                    ))}
                </ol>
            )}
            {invalidRules.length > 0 ? (
                <details className="text-dhis2-yellow-900">
                    <summary className="cursor-pointer">
                        {invalidRules.length === 1
                            ? i18n.t(
                                  "1 rule is skipped because it doesn't parse"
                              )
                            : i18n.t(
                                  "{{count}} rules are skipped because they don't parse",
                                  { count: invalidRules.length }
                              )}
                    </summary>
                    <ul className="m-0 mt-2 flex list-none flex-col gap-2 p-0 text-dhis2-grey-800">
                        {invalidRules.map((rule) => (
                            <li key={`${rule.ruleId}/${rule.actionId ?? ''}`}>
                                <RuleName>{rule.ruleName}</RuleName>
                                <code className="mt-1 block rounded-dhis2-sm bg-dhis2-grey-100 px-2 py-1 font-mono text-xs break-words whitespace-pre-wrap">
                                    {rule.expression}
                                </code>
                                <span className="text-xs text-dhis2-grey-700">
                                    {rule.message}
                                </span>
                            </li>
                        ))}
                    </ul>
                </details>
            ) : null}
        </aside>
    )
}
