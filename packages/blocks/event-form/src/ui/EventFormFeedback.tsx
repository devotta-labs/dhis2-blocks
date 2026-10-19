import React, { useId } from 'react'
import { Alert, AlertDescription } from '@/registry/dhis2/ui/alert'
import { cn } from '@/registry/dhis2/ui/cn'
import { useEventFormRulesContext } from './EventForm/EventFormContext'
import { useEventFormText } from './EventFormText'

/**
 * What the program rules want the user to see that belongs to no question: their display texts,
 * key-value pairs and messages for the whole form. Renders nothing when there are none.
 */
export const EventFormFeedback = ({ className }: { className?: string }) => {
    const translate = useEventFormText()
    const { effects } = useEventFormRulesContext('EventFormFeedback')
    const headingId = useId()
    const messages = effects?.messages.get('form') ?? []
    const texts = effects?.displayTexts ?? []
    const pairs = effects?.keyValuePairs ?? []
    if (messages.length === 0 && texts.length === 0 && pairs.length === 0) {
        return null
    }
    return (
        <section
            aria-labelledby={headingId}
            className={cn(
                'flex flex-col gap-3 rounded-dhis2-md bg-dhis2-card p-4 shadow-dhis2-card',
                className
            )}
        >
            <h2
                id={headingId}
                className="m-0 text-base leading-snug font-medium text-dhis2-grey-900"
            >
                {translate('Feedback')}
            </h2>
            {messages.map((message, index) => (
                <Alert
                    key={`${message.by.actionId}-${index}`}
                    variant={
                        message.kind === 'error' ? 'destructive' : 'warning'
                    }
                    title={message.by.ruleName}
                >
                    <AlertDescription>{message.text}</AlertDescription>
                </Alert>
            ))}
            {texts.length > 0 && (
                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {texts.map((item, index) => (
                        <li
                            key={`${item.by.actionId}-${index}`}
                            title={item.by.ruleName}
                            className="text-sm whitespace-pre-line text-dhis2-grey-900"
                        >
                            {item.value === ''
                                ? item.label
                                : `${item.label} ${item.value}`}
                        </li>
                    ))}
                </ul>
            )}
            {pairs.length > 0 && (
                <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                    {pairs.map((item, index) => (
                        <div
                            key={`${item.by.actionId}-${index}`}
                            title={item.by.ruleName}
                            className="contents"
                        >
                            <dt className="text-dhis2-grey-700">
                                {item.label}
                            </dt>
                            <dd className="m-0 text-dhis2-grey-900">
                                {item.value}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
        </section>
    )
}
