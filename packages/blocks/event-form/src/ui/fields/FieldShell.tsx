import React, { useId, type ReactNode } from 'react'
import { Field, FieldError, FieldLabel } from '@/registry/dhis2/ui/field'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/registry/dhis2/ui/popover'
import type { FieldModel } from '../../model/buildFormModel'
import { useEventFormText } from '../EventFormText'

/** What every field widget receives. */
export interface FieldWidgetProps {
    field: FieldModel
    /** Stores the value in tracker API format; `undefined` clears it. */
    onCommit(value: string | undefined): void
    disabled: boolean
}

/** Attributes that tie a control to its label, description and messages. Spread them on the control. */
export interface ControlProps {
    id: string
    'aria-labelledby': string
    'aria-describedby': string | undefined
    'aria-invalid': true | undefined
    'aria-required': true | undefined
}

/**
 * The label of a field with a description: a popover trigger with a dotted underline, so a long
 * description doesn't push the form apart. It stands in for `FieldLabel` (the control is named
 * through `aria-labelledby`), which keeps the trigger within the form's component-depth budget.
 */
const DescribedLabel = ({
    id,
    label,
    description,
}: {
    id: string
    label: string
    description: string
}) => (
    <Popover>
        <PopoverTrigger
            id={id}
            className="w-fit cursor-help rounded-dhis2-sm text-start text-sm leading-snug text-dhis2-grey-900 underline decoration-dhis2-grey-600 decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-dhis2-ring"
        >
            {label}
        </PopoverTrigger>
        <PopoverContent align="start" sideOffset={4}>
            <p className="m-0 whitespace-pre-line">{description}</p>
        </PopoverContent>
    </Popover>
)

type MessageSource = 'rule' | 'value'

const Tag = ({ source }: { source: MessageSource }) => {
    const translate = useEventFormText()
    return (
        <span className="me-1.5 rounded-dhis2-sm bg-dhis2-grey-200 px-1.5 py-px text-xs font-medium text-dhis2-grey-800">
            {source === 'rule' ? translate('Rule') : translate('Value')}
        </span>
    )
}

const hasError = (field: FieldModel, localError: string | undefined) =>
    field.requiredMissing ||
    localError !== undefined ||
    field.messages.error !== undefined ||
    field.messages.ruleErrors.length > 0

/**
 * Label, description, messages and the "calculated by a program rule" note around one control.
 * The control comes from `children`, which receives the attributes that link it to the rest.
 * Rule messages carry a `Rule` tag and value errors a `Value` tag, so a message says whether the
 * value or a program rule is the problem.
 */
export const FieldShell = ({
    field,
    localError,
    children,
}: {
    field: FieldModel
    /** An error the widget found in what is being typed, as an untranslated key. */
    localError?: string
    children: (control: ControlProps) => ReactNode
}) => {
    const translate = useEventFormText()
    const baseId = useId()
    const controlId = `${baseId}-control`
    const labelId = `${baseId}-label`
    const descriptionId = `${baseId}-description`
    const assignedId = `${baseId}-assigned`
    const messagesId = `${baseId}-messages`

    const { messages } = field
    const errorLines: { key: string; source: MessageSource; text: string }[] =
        []
    if (field.requiredMissing) {
        errorLines.push({
            key: 'required',
            source: 'value',
            text: translate('This field is required'),
        })
    }
    if (localError !== undefined) {
        errorLines.push({
            key: 'local',
            source: 'value',
            text: translate(localError),
        })
    }
    if (messages.error !== undefined) {
        errorLines.push({
            key: 'error',
            source: 'value',
            text: translate(messages.error),
        })
    }
    const ruleErrors = messages.ruleErrors.map((message, index) => ({
        key: `rule-${index}`,
        ruleName: message.by.ruleName,
        text: message.text,
    }))
    // Messages that only matter when completing are shown as warnings until then.
    const warnings = [
        { key: 'warning', text: messages.warning },
        { key: 'errorOnComplete', text: messages.errorOnComplete },
        { key: 'warningOnComplete', text: messages.warningOnComplete },
    ].flatMap(({ key, text }) => (text === undefined ? [] : [{ key, text }]))
    const hasMessages =
        errorLines.length > 0 || ruleErrors.length > 0 || warnings.length > 0
    const invalid = hasError(field, localError)

    const describedBy =
        [
            field.description !== undefined ? descriptionId : undefined,
            field.assignedBy !== undefined ? assignedId : undefined,
            hasMessages ? messagesId : undefined,
        ]
            .filter((id) => id !== undefined)
            .join(' ') || undefined

    return (
        <Field data-field-id={field.id} data-invalid={invalid || undefined}>
            <div className="flex items-baseline gap-1">
                {field.description === undefined ? (
                    <FieldLabel id={labelId} htmlFor={controlId}>
                        {field.label}
                    </FieldLabel>
                ) : (
                    <DescribedLabel
                        id={labelId}
                        label={field.label}
                        description={field.description}
                    />
                )}
                {field.required && (
                    <span aria-hidden="true" className="text-dhis2-red-500">
                        *
                    </span>
                )}
            </div>
            {field.description !== undefined && (
                // Not shown inline (the label's popover shows it), but still read with the control.
                <span id={descriptionId} hidden>
                    {field.description}
                </span>
            )}
            {children({
                id: controlId,
                'aria-labelledby': labelId,
                'aria-describedby': describedBy,
                'aria-invalid': invalid ? true : undefined,
                'aria-required': field.required ? true : undefined,
            })}
            {field.assignedBy !== undefined && (
                <p
                    id={assignedId}
                    title={field.assignedBy.ruleName}
                    className="m-0 text-sm text-dhis2-grey-700"
                >
                    {translate('Calculated by a program rule')}
                </p>
            )}
            {hasMessages && (
                <div id={messagesId} className="flex flex-col gap-1">
                    {errorLines.map((line) => (
                        <FieldError
                            key={line.key}
                            data-testid={`field-message-${line.source}`}
                        >
                            <Tag source={line.source} />
                            <span>{line.text}</span>
                        </FieldError>
                    ))}
                    {ruleErrors.map((line) => (
                        <FieldError
                            key={line.key}
                            title={line.ruleName}
                            data-testid="field-message-rule"
                        >
                            <Tag source="rule" />
                            <span>{line.text}</span>
                        </FieldError>
                    ))}
                    {warnings.map(({ key, text }) => (
                        <p
                            key={key}
                            data-testid="field-message-rule"
                            className="m-0 text-sm text-dhis2-yellow-800"
                        >
                            <Tag source="rule" />
                            <span>{text}</span>
                        </p>
                    ))}
                </div>
            )}
        </Field>
    )
}
