import React from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/registry/dhis2/ui/alert'
import {
    useEventFormPublic,
    useEventFormRulesContext,
} from './EventForm/EventFormContext'
import { useEventFormText } from './EventFormText'

/**
 * On an existing event: the stored values the program rules clear or change, which is what Save
 * will send. Opening the event changes nothing by itself, so this is how the user learns of it.
 */
export const EventFormRuleNotice = () => {
    const translate = useEventFormText()
    const { model, state } = useEventFormPublic('EventFormRuleNotice')
    const { ruleChanges } = useEventFormRulesContext('EventFormRuleNotice')
    if (state.isNew || ruleChanges.length === 0) {
        return null
    }
    const count = ruleChanges.length
    return (
        <Alert variant="warning" data-testid="event-form-rule-notice">
            <AlertTitle>
                {count === 1
                    ? translate(
                          '1 value will be changed by program rules when you save'
                      )
                    : translate(
                          '{{count}} values will be changed by program rules when you save',
                          { count }
                      )}
            </AlertTitle>
            <AlertDescription>
                <ul className="m-0 flex list-disc flex-col gap-0.5 ps-5">
                    {ruleChanges.map((change) => {
                        const label =
                            model.fields.get(change.fieldId)?.label ??
                            change.fieldId
                        const rule = change.by.ruleName
                        return (
                            <li key={change.fieldId}>
                                {change.kind === 'cleared'
                                    ? translate(
                                          '{{label}} will be cleared by the rule "{{rule}}"',
                                          { label, rule }
                                      )
                                    : translate(
                                          '{{label}} will be set to {{value}} by the rule "{{rule}}"',
                                          { label, rule, value: change.to }
                                      )}
                            </li>
                        )
                    })}
                </ul>
            </AlertDescription>
        </Alert>
    )
}
