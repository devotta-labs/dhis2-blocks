import i18n from '@dhis2/d2-i18n'
import { useMemo, useRef } from 'react'
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
import { Label } from '@/components/dhis2/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'
import { focusInto } from '../focusInto'
import type { useDraft } from '../useDraft'
import { OptionComboInput } from './OptionComboInput'

/** Up to this many visible options are radios, or a multi-select's boxes; more are searched. */
export const RADIO_LIMIT = 5

const NO_OPTIONS: ReadonlyArray<Option> = []

const yesNo = (): ReadonlyArray<Option> => [
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
 * The choice kinds, each pick reported at once: Yes/No and short option sets as radios, an option set of more than five
 * visible options as a search, Yes-only as a checkbox. Without `required`, Clear reports no value. Options a rule hid
 * are not offered, unless the field holds one.
 */
export const ChoiceInput = ({
    id,
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
    const kind = cellKind(field)
    const options = useMemo(
        () => (kind === 'boolean' ? yesNo() : (field.options ?? NO_OPTIONS)),
        [kind, field.options]
    )
    const offered = useMemo(
        () => offeredOptions(options, hiddenOptions, value),
        [options, hiddenOptions, value]
    )
    // Held options do not count: a pick that drops the held one must not change the control.
    const visible = options.filter(
        ({ code }) => !hiddenOptions?.has(code)
    ).length
    const meta: ValueMeta = {
        valueType: field.valueType,
        optionSet: {
            options: options.map(({ code, name }) => ({
                code,
                displayName: name,
            })),
        },
    }
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
    const shown = formatDhis2Value(value, meta, {
        calendar: settings.calendar,
    })
    return (
        <div
            ref={box}
            className={
                kind === 'boolean'
                    ? 'flex flex-wrap items-center gap-x-6 gap-y-2'
                    : 'flex flex-col gap-2'
            }
        >
            {visible > RADIO_LIMIT ? (
                <OptionComboInput
                    id={id}
                    offered={offered}
                    value={value}
                    draft={draft}
                    readOnly={readOnly}
                    required={required}
                />
            ) : (
                <RadioGroup
                    id={id}
                    tabIndex={-1}
                    onFocus={focusInto(
                        '[role="radio"][aria-checked="true"]',
                        '[role="radio"]'
                    )}
                    // An empty value checks no radio.
                    value={known ? value : ''}
                    readOnly={readOnly}
                    // Not `required`: the radios' form inputs have no name, so each would be a group of its own,
                    // missing when unchecked, and hold back the host's form.
                    aria-required={required || undefined}
                    onValueChange={(code: string) => onChange(code)}
                    className={
                        kind === 'boolean' ? 'flex w-auto gap-6' : undefined
                    }
                >
                    {offered.map(({ code, name, description }, index) =>
                        description === undefined ? (
                            <Label key={code} className="cursor-pointer">
                                <RadioGroupItem
                                    value={code}
                                    aria-label={name}
                                />
                                {name}
                            </Label>
                        ) : (
                            // The house radio with a description: the radio, then its name and what it means.
                            <Label
                                key={code}
                                className="cursor-pointer items-start"
                            >
                                <RadioGroupItem
                                    value={code}
                                    aria-label={name}
                                    aria-describedby={`${id}-option-${index}`}
                                    className="mt-px"
                                />
                                <span className="flex flex-col gap-1">
                                    {name}
                                    <span
                                        id={`${id}-option-${index}`}
                                        className="text-sm font-normal text-dhis2-muted-foreground"
                                    >
                                        {description}
                                    </span>
                                </span>
                            </Label>
                        )
                    )}
                </RadioGroup>
            )}
            {value !== undefined && !known ? (
                <p className="text-sm text-dhis2-muted-foreground">{shown}</p>
            ) : null}
            {required || readOnly || value === undefined ? null : (
                <div>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            onChange(null)
                            // The button leaves with the value; focus goes to the choice, not the page.
                            box.current
                                ?.querySelector<HTMLElement>(
                                    '[role="radio"], [role="combobox"]'
                                )
                                ?.focus()
                        }}
                    >
                        {i18n.t('Clear')}
                    </Button>
                </div>
            )}
        </div>
    )
}
