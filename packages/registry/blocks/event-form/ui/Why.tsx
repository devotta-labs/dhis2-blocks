import i18n from '@dhis2/d2-i18n'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/dhis2/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import { blameLead, reasonLabel } from '../lib/explain'
import type { Blame } from '@/components/program-rules'

const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

const Explanation = ({
    blame,
    formId,
    jumpTo,
}: {
    blame: Blame
    formId: string
    jumpTo(control: HTMLElement): void
}) => {
    const [ruleShown, setRuleShown] = useState(false)
    const conditionId = useId()
    return (
        <section className="flex flex-col gap-2">
            <p className="m-0">{blameLead(blame)}</p>
            {blame.because.length === 0 ? null : (
                <ul className="m-0 flex list-none flex-col items-start p-0">
                    {blame.because.map((reason) => {
                        const answer = i18n.t('{{label}}: {{value}}', {
                            ...AS_IS,
                            label: reasonLabel(reason),
                            value: reason.value ?? i18n.t('not answered'),
                        })
                        const control =
                            reason.from === undefined
                                ? document.getElementById(
                                      `${formId}-${reason.fieldId}`
                                  )
                                : null
                        return (
                            <li
                                key={`${reason.fieldId}-${reason.from?.kind ?? 'form'}`}
                            >
                                {control === null ? (
                                    answer
                                ) : (
                                    <Button
                                        variant="link"
                                        size="sm"
                                        className="h-auto min-h-6 px-0 text-start whitespace-normal"
                                        onClick={() => jumpTo(control)}
                                    >
                                        {answer}
                                    </Button>
                                )}
                            </li>
                        )
                    })}
                </ul>
            )}
            <p className="m-0 text-dhis2-muted-foreground">
                {i18n.t('Rule: {{rule}}', { ...AS_IS, rule: blame.ruleName })}
            </p>
            <div className="flex flex-col items-start gap-1">
                <Button
                    variant="link"
                    size="sm"
                    className="px-0"
                    aria-expanded={ruleShown}
                    aria-controls={conditionId}
                    onClick={() => setRuleShown(!ruleShown)}
                >
                    {i18n.t('Show rule')}
                </Button>
                <code
                    id={conditionId}
                    hidden={!ruleShown}
                    className="font-mono break-words"
                >
                    {blame.condition}
                </code>
            </div>
        </section>
    )
}

/**
 * What each rule did to `label`, in a popover: why, the answers it read (each one on the page a way to its field), the
 * rule's name and its condition. Opened by `marker` beside the field's label, or by `Why?` in a list of hidden questions.
 */
export const Why = ({
    label,
    blames,
    formId,
    marker,
}: {
    label: string
    blames: readonly Blame[]
    formId: string
    marker?: string
}) => {
    const [open, setOpen] = useState(false)
    const jump = useRef<HTMLElement | null>(null)
    return (
        <Popover open={open} onOpenChange={setOpen}>
            {marker === undefined ? (
                <PopoverTrigger
                    render={
                        <Button
                            variant="link"
                            size="sm"
                            className="self-start"
                        />
                    }
                >
                    {i18n.t('Why?')}
                    <span className="sr-only"> {label}</span>
                </PopoverTrigger>
            ) : (
                <PopoverTrigger
                    render={
                        <Button
                            variant="secondary"
                            size="sm"
                            className="h-6 rounded-full px-2 text-xs tracking-normal"
                        />
                    }
                    aria-label={i18n.t('{{marker}}, {{label}}: why', {
                        ...AS_IS,
                        marker,
                        label,
                    })}
                >
                    {marker}
                </PopoverTrigger>
            )}
            <PopoverContent
                align="start"
                className="w-80"
                finalFocus={() => {
                    const to = jump.current
                    jump.current = null
                    return to ?? true
                }}
            >
                <PopoverTitle className="sr-only">
                    {i18n.t('Why? {{label}}', { ...AS_IS, label })}
                </PopoverTitle>
                {blames.map((blame, index) => (
                    // oxlint-disable-next-line react/no-array-index-key -- one rule can do two things to a field
                    <Explanation
                        key={index}
                        blame={blame}
                        formId={formId}
                        jumpTo={(control) => {
                            jump.current = control
                            setOpen(false)
                        }}
                    />
                ))}
            </PopoverContent>
        </Popover>
    )
}
