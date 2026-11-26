import type { Option } from '@/components/dhis2-value-types'
import { Toggle } from '@/components/dhis2/ui/toggle'
import { focusInto } from '../focusInto'

/**
 * Yes and No as two buttons, each its own tab stop, so a read-only answer is reached too. Pressing the chosen one again
 * reports no value, unless the field is `required`.
 */
export const YesNoButtons = ({
    id,
    labelledBy,
    describedBy,
    options,
    value,
    invalid,
    readOnly,
    required,
    onChange,
}: {
    id: string
    labelledBy: string
    describedBy: string | undefined
    options: ReadonlyArray<Option>
    value: string | undefined
    invalid: boolean
    readOnly: boolean
    required: boolean
    onChange(value: string | null): void
}) => (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- passes focus given to the field's id on to a button; the buttons are the controls
    <div
        id={id}
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-invalid={invalid || undefined}
        tabIndex={-1}
        onFocus={focusInto('[aria-pressed="true"]', 'button')}
        className="group/yes-no flex w-fit items-center gap-1"
    >
        {options.map(({ code, name }) => (
            <Toggle
                key={code}
                variant="outline"
                pressed={value === code}
                aria-disabled={readOnly || undefined}
                onPressedChange={(pressed) => {
                    if (readOnly || (required && !pressed)) {
                        return
                    }
                    onChange(pressed ? code : null)
                }}
                className="min-w-16 group-data-invalid/yes-no:not-data-pressed:border-dhis2-destructive-border aria-disabled:pointer-events-none"
            >
                {name}
            </Toggle>
        ))}
    </div>
)
