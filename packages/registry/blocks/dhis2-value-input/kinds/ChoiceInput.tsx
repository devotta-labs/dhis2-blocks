import i18n from '@dhis2/d2-i18n'
import { IconCross16 } from '@dhis2/ui-icons'
import { useId, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { formatDhis2Value } from '@/components/dhis2-value-display'
import type { ValueMeta } from '@/components/dhis2-value-display'
import { cellKind } from '@/components/dhis2-value-types'
import type {
    Field,
    Option,
    ValueSettings,
} from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import {
    FieldContent,
    FieldDescription,
    FieldItem,
    FieldLabel,
    FieldTitle,
} from '@/components/dhis2/ui/field'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'
import {
    ToggleGroup,
    ToggleGroupItem,
} from '@/components/dhis2/ui/toggle-group'
import { focusInto } from '../focusInto'
import type { useDraft } from '../useDraft'
import { OptionComboInput } from './OptionComboInput'

/** Up to this many visible options are radios, or a multi-select's boxes; more are searched. */
export const RADIO_LIMIT = 5

const NO_OPTIONS: ReadonlyArray<Option> = []

/** The options a person can see. Held ones a rule hid do not count: a pick that drops one must not change the control. */
export const visibleCount = (
    options: ReadonlyArray<Option>,
    hiddenOptions: ReadonlySet<string> | undefined
) => options.filter(({ code }) => !hiddenOptions?.has(code)).length

/** Whether a choice field is a group named by its title: Yes/No buttons, or the radios of an option set of five or fewer visible options. */
export const asGroup = (
    field: Field,
    hiddenOptions: ReadonlySet<string> | undefined
) => {
    const kind = cellKind(field)
    return (
        kind === 'boolean' ||
        (kind === 'option' &&
            visibleCount(field.options ?? NO_OPTIONS, hiddenOptions) <=
                RADIO_LIMIT)
    )
}

const yesNo = () => [
    { code: 'true', name: i18n.t('Yes') },
    { code: 'false', name: i18n.t('No') },
]

/** The options a person may choose: those a rule hid are left out, unless the field holds one. */
export const offeredOptions = (
    options: ReadonlyArray<Option>,
    hiddenOptions: ReadonlySet<string> | undefined,
    value: string | undefined
) =>
    hiddenOptions === undefined
        ? options
        : options.filter(
              ({ code }) => !hiddenOptions.has(code) || code === value
          )

/**
 * The choice kinds, each pick reported at once: Yes/No as two buttons, a short option set as radios, an option set of
 * more than five visible options as a search, Yes-only as a checkbox. Without `required`, pressing the chosen Yes or No
 * again, or an option set's Clear, reports no value. Options a rule hid are not offered, unless the field holds one.
 */
export const ChoiceInput = ({
    id,
    title,
    describedBy,
    field,
    value,
    hiddenOptions,
    settings,
    draft,
    readOnly,
    required,
    onChange,
}: {
    id: string
    /** A group's name, shown above it. */
    title: ReactNode
    /** The ids of what describes the field, for the Yes/No buttons' group: a field's own controls are linked by the field. */
    describedBy: string | undefined
    field: Field
    value: string | undefined
    settings: ValueSettings
    /** The text typed into a long option set's search. */
    draft: ReturnType<typeof useDraft>
    hiddenOptions: ReadonlySet<string> | undefined
    readOnly: boolean
    required: boolean
    onChange(value: string | null): void
}) => {
    const box = useRef<HTMLDivElement>(null)
    const titleId = useId()
    const kind = cellKind(field)
    const options = useMemo(
        () => (kind === 'boolean' ? yesNo() : (field.options ?? NO_OPTIONS)),
        [kind, field.options]
    )
    const offered = useMemo(
        () => offeredOptions(options, hiddenOptions, value),
        [options, hiddenOptions, value]
    )
    const known = options.some(({ code }) => code === value)

    if (kind === 'trueOnly') {
        return (
            <Checkbox
                id={id}
                checked={value === 'true'}
                readOnly={readOnly}
                aria-required={required || undefined}
                onCheckedChange={(checked) => onChange(checked ? 'true' : null)}
            />
        )
    }
    const meta: ValueMeta = {
        valueType: field.valueType,
        optionSet: { options: [] },
    }
    const shown = formatDhis2Value(value, meta, {
        calendar: settings.calendar,
    })
    const clear = () => {
        onChange(null)
        box.current?.querySelector<HTMLElement>('[role="radio"]')?.focus()
    }
    const clearButton =
        required || readOnly || value === undefined ? null : (
            <Button
                type="button"
                size="sm"
                variant="ghost"
                className="-ms-1.5 text-dhis2-muted-foreground hover:text-dhis2-foreground"
                onClick={clear}
            >
                <IconCross16 />
                {i18n.t('Clear')}
            </Button>
        )
    const pressed = value === 'true' || value === 'false' ? [value] : []
    const yesNoButtons =
        kind === 'boolean' ? (
            <ToggleGroup
                id={id}
                aria-labelledby={titleId}
                aria-describedby={describedBy}
                tabIndex={-1}
                onFocus={focusInto('[aria-pressed="true"]', 'button')}
                variant="outline"
                value={pressed}
                onValueChange={(next: string[]) => {
                    if (readOnly || (required && next.length === 0)) {
                        return
                    }
                    onChange(next[0] ?? null)
                }}
            >
                {options.map(({ code, name }) => (
                    <ToggleGroupItem
                        key={code}
                        value={code}
                        aria-disabled={readOnly || undefined}
                        className="min-w-16 aria-disabled:pointer-events-none"
                    >
                        {name}
                    </ToggleGroupItem>
                ))}
            </ToggleGroup>
        ) : undefined
    const radios =
        kind !== 'boolean' && asGroup(field, hiddenOptions) ? (
            <RadioGroup
                id={id}
                aria-labelledby={titleId}
                tabIndex={-1}
                onFocus={focusInto(
                    '[role="radio"][aria-checked="true"]',
                    '[role="radio"]'
                )}
                value={known ? value : ''}
                readOnly={readOnly}
                aria-required={required || undefined}
                onValueChange={(code: string) => onChange(code)}
                className="flex flex-col gap-2"
            >
                {offered.map(({ code, name, description }) => (
                    <FieldItem key={code}>
                        <RadioGroupItem value={code} />
                        {description === undefined ? (
                            <FieldLabel className="cursor-pointer">
                                {name}
                            </FieldLabel>
                        ) : (
                            <FieldContent>
                                <FieldLabel className="cursor-pointer">
                                    {name}
                                </FieldLabel>
                                <FieldDescription>
                                    {description}
                                </FieldDescription>
                            </FieldContent>
                        )}
                    </FieldItem>
                ))}
            </RadioGroup>
        ) : undefined
    const group = yesNoButtons ?? radios
    return (
        <div ref={box} className="flex flex-col gap-2">
            {group === undefined ? (
                <OptionComboInput
                    id={id}
                    offered={offered}
                    value={value}
                    draft={draft}
                    readOnly={readOnly}
                    required={required}
                />
            ) : (
                <FieldTitle id={titleId}>{title}</FieldTitle>
            )}
            {group}
            {value !== undefined && !known ? (
                <p className="text-sm text-dhis2-muted-foreground">{shown}</p>
            ) : null}
            {radios !== undefined && clearButton ? (
                <div>{clearButton}</div>
            ) : null}
        </div>
    )
}
