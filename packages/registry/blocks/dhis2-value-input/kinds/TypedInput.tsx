import type { Ref } from 'react'
import { inputModeFor, textDirectionFor } from '@/components/dhis2-value-types'
import type { Field } from '@/components/dhis2-value-types'
import { cn } from '@/components/dhis2/ui/cn'
import { Input } from '@/components/dhis2/ui/input'
import { InputGroupInput } from '@/components/dhis2/ui/input-group'
import { composing } from '../composing'
import type { useDraft } from '../useDraft'
import { intoOwnCalendar } from './ownCalendar'

export const READ_ONLY_CLASS = 'bg-dhis2-muted text-dhis2-muted-foreground'

/** Text and numbers typed into the house input, reported when the field is left or Enter is pressed. */
export const TypedInput = ({
    id,
    inputRef,
    field,
    draft,
    readOnly,
    required,
    className,
    grouped = false,
}: {
    id: string
    inputRef?: Ref<HTMLInputElement>
    field: Field
    draft: ReturnType<typeof useDraft>
    readOnly: boolean
    required: boolean
    className?: string
    /** Inside a house `InputGroup`, which draws the box. */
    grouped?: boolean
}) => {
    const Control = grouped ? InputGroupInput : Input
    return (
        <Control
            ref={inputRef}
            id={id}
            type="text"
            inputMode={inputModeFor(field)}
            dir={textDirectionFor(field)}
            autoComplete="off"
            spellCheck={false}
            readOnly={readOnly}
            aria-required={required || undefined}
            value={draft.text}
            onChange={(event) => draft.change(event.target.value)}
            onBlur={(event) => {
                // The input's own calendar is drawn outside it, and is still the field.
                if (
                    !intoOwnCalendar(event.currentTarget, event.relatedTarget)
                ) {
                    draft.commit()
                }
            }}
            onKeyDown={(event) => {
                // Here, not on keyup: a surrounding form submits on Enter, and must get what was typed.
                if (event.key === 'Enter' && !composing(event)) {
                    draft.commit()
                }
            }}
            // On a right-to-left page the text keeps to the page's start, whatever its own direction.
            className={cn(
                readOnly && READ_ONLY_CLASS,
                'rtl:text-right',
                className
            )}
        />
    )
}
