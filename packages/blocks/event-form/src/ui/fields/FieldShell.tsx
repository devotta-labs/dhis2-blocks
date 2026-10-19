import React, {
    useId,
    useLayoutEffect,
    useRef,
    useState,
    type ReactNode,
} from 'react'
import { Button } from '@/registry/dhis2/ui/button'
import { cn } from '@/registry/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/registry/dhis2/ui/field'
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
 * The description, clamped to two lines. "Show more" appears only when the text is cut off, and
 * stays (as "Show less") once it is expanded.
 */
const ClampedDescription = ({ id, text }: { id: string; text: string }) => {
    const translate = useEventFormText()
    const wrapper = useRef<HTMLDivElement>(null)
    const [expanded, setExpanded] = useState(false)
    const [clamped, setClamped] = useState(false)
    useLayoutEffect(() => {
        const paragraph = wrapper.current?.firstElementChild
        if (!paragraph || expanded) {
            return
        }
        const measure = () =>
            setClamped(paragraph.scrollHeight > paragraph.clientHeight + 1)
        measure()
        const observer = new ResizeObserver(measure)
        observer.observe(paragraph)
        return () => observer.disconnect()
    }, [text, expanded])
    return (
        <div ref={wrapper} className="flex flex-col items-start">
            <FieldDescription
                id={id}
                className={cn(!expanded && 'line-clamp-2')}
            >
                {text}
            </FieldDescription>
            {clamped && (
                <Button
                    type="button"
                    variant="link"
                    aria-expanded={expanded}
                    aria-controls={id}
                    className="h-auto p-0 text-sm"
                    onClick={() => setExpanded((current) => !current)}
                >
                    {expanded ? translate('Show less') : translate('Show more')}
                </Button>
            )}
        </div>
    )
}

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
                <FieldLabel id={labelId} htmlFor={controlId}>
                    {field.label}
                </FieldLabel>
                {field.required && (
                    <span aria-hidden="true" className="text-dhis2-red-500">
                        *
                    </span>
                )}
            </div>
            {field.description !== undefined && (
                <ClampedDescription
                    id={descriptionId}
                    text={field.description}
                />
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
