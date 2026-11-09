import i18n from '@dhis2/d2-i18n'
import { useId } from 'react'
import type { ReactNode } from 'react'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cellKind } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field as FieldRoot,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import type { EditorProblem } from './editors/popupEditors'
import { ChoiceInput } from './kinds/ChoiceInput'
import { READ_ONLY_CLASS, TypedInput } from './kinds/TypedInput'
import { useDraft } from './useDraft'

type Tone = 'error' | 'warning' | 'info'

export interface ValueInputProps {
    /** Another value type, field mask or option set is another field, and replaces what was typed. */
    field: Field
    settings: ValueSettings
    label: string
    description?: string
    /** The value as DHIS2 stores it. */
    value: string | undefined
    /** Called when a value is committed (the field is left, Enter, a pick), never per keystroke. */
    onChange(value: string | null, problem?: EditorProblem): void
    required?: boolean
    /** Why the field cannot be edited; absent means it can. */
    readOnly?: string
    /** Option codes a rule hides. */
    hiddenOptions?: ReadonlySet<string>
    /** Rule or host messages, shown under the field. */
    messages?: ReadonlyArray<{ tone: Tone; text: string }>
    /** The name of a stored org unit or file id. */
    valueName?: string
    /** The link to the stored file or image. */
    fileUrl?: string
    id?: string
}

/** Why a value type no control edits is read-only, as the data entry grid says it too. */
export const editedElsewhere = () => i18n.t('Edit this field in its own form')

// Messages are shown as the rules and the host give them, not HTML-escaped.
const AS_IS = { nsSeparator: '::', interpolation: { escapeValue: false } }

// The tone in words as well as colour.
const TONES = {
    error: {
        border: 'border-dhis2-destructive-indicator',
        say: (message: string) =>
            i18n.t('Error: {{message}}', { ...AS_IS, message }),
    },
    warning: {
        border: 'border-dhis2-warning-indicator',
        say: (message: string) =>
            i18n.t('Warning: {{message}}', { ...AS_IS, message }),
    },
    info: {
        border: 'border-dhis2-neutral-indicator',
        say: (message: string) =>
            i18n.t('Information: {{message}}', { ...AS_IS, message }),
    },
} satisfies Record<Tone, { border: string; say: (message: string) => string }>

const metaOf = ({ valueType, options }: Field): ValueMeta => ({
    valueType,
    optionSet: options && {
        options: options.map(({ code, name }) => ({ code, displayName: name })),
    },
})

/** A form control for any DHIS2 value type: labelled, described, and reporting a value only when it is committed. */
export const ValueInput = ({
    field,
    settings,
    label,
    description,
    value,
    onChange,
    required = false,
    readOnly,
    messages = [],
    hiddenOptions,
    id: givenId,
}: ValueInputProps): ReactNode => {
    const generatedId = useId()
    const id = givenId ?? generatedId
    const kind = cellKind(field)
    const typed = kind === 'text' || kind === 'number'
    const edited =
        typed || kind === 'boolean' || kind === 'trueOnly' || kind === 'option'
    const reason = readOnly ?? (edited ? undefined : editedElsewhere())
    const draft = useDraft({
        field,
        settings,
        value,
        onChange,
        readOnly: reason !== undefined,
    })
    const invalid =
        draft.problem !== undefined ||
        messages.some(({ tone }) => tone === 'error')

    let control: ReactNode
    if (typed) {
        control = (
            <TypedInput
                id={id}
                field={field}
                draft={draft}
                readOnly={reason !== undefined}
                required={required}
            />
        )
    } else if (edited) {
        control = (
            <ChoiceInput
                id={id}
                field={field}
                value={value}
                hiddenOptions={hiddenOptions}
                settings={settings}
                readOnly={reason !== undefined}
                required={required}
                onChange={onChange}
            />
        )
    } else {
        control = (
            <Input
                id={id}
                type="text"
                readOnly
                aria-required={required || undefined}
                value={formatDhis2Value(value, metaOf(field), {
                    calendar: settings.calendar,
                })}
                className={READ_ONLY_CLASS}
            />
        )
    }

    return (
        <FieldRoot invalid={invalid} className="gap-1">
            <FieldLabel>
                {label}
                {required ? (
                    <span aria-hidden="true" className="text-dhis2-destructive">
                        *
                    </span>
                ) : null}
            </FieldLabel>
            {control}
            {description === undefined ? null : (
                <FieldDescription>{description}</FieldDescription>
            )}
            {reason === undefined ? null : (
                <FieldDescription>{reason}</FieldDescription>
            )}
            {draft.problem === undefined ? null : (
                // An alert, said when it appears or changes: not again while more is typed.
                <FieldError>{draft.problem.message}</FieldError>
            )}
            {messages.map(({ tone, text }, index) => (
                <FieldDescription
                    // oxlint-disable-next-line react/no-array-index-key -- messages have no ids, and two can say the same
                    key={index}
                    className={cn('border-s-2 ps-1.5', TONES[tone].border)}
                >
                    {TONES[tone].say(text)}
                </FieldDescription>
            ))}
        </FieldRoot>
    )
}
