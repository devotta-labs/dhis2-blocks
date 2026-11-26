import type { Option } from '@/components/dhis2-value-types'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import { focusInto } from '../focusInto'

/**
 * Yes and No as a toggle group: one tab stop, with arrow keys between the two. Pressing the chosen one again reports no
 * value (`null`), which a host that needs an answer leaves unsaved. Read-only buttons are not `aria-disabled`, which
 * arrow keys would skip: the group's description says why they cannot be changed.
 */
export const YesNoButtons = ({
    id,
    labelledBy,
    describedBy,
    options,
    value,
    invalid,
    readOnly,
    onChange,
}: {
    id: string
    labelledBy: string
    describedBy: string | undefined
    options: ReadonlyArray<Option>
    value: string | undefined
    invalid: boolean
    readOnly: boolean
    onChange(value: string | null): void
}) => (
    <ToggleGroup
        id={id}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        data-invalid={invalid || undefined}
        data-readonly={readOnly || undefined}
        tabIndex={-1}
        onFocus={focusInto('[aria-pressed="true"]', 'button')}
        variant="outline"
        value={value === undefined ? [] : [value]}
        onValueChange={(next: string[]) => {
            if (!readOnly) {
                onChange(next[0] ?? null)
            }
        }}
        className="group/yes-no"
    >
        {options.map(({ code, name }) => (
            <ToggleGroupItem
                key={code}
                value={code}
                className="min-w-16 group-data-invalid/yes-no:not-data-pressed:border-dhis2-destructive-border group-data-readonly/yes-no:pointer-events-none"
            >
                {name}
            </ToggleGroupItem>
        ))}
    </ToggleGroup>
)
