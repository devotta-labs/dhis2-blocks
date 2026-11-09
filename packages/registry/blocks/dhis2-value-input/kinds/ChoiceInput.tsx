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
import { OptionComboInput } from './OptionComboInput'

/** Up to this many visible options are radios; more are searched. */
const RADIO_LIMIT = 5

const NO_OPTIONS: ReadonlyArray<Option> = []

const yesNo = (): ReadonlyArray<Option> => [
    { code: 'true', name: i18n.t('Yes') },
    { code: 'false', name: i18n.t('No') },
]

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
    readOnly,
    required,
    onChange,
}: {
    id: string
    field: Field
    value: string | undefined
    settings: ValueSettings
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
        () =>
            hiddenOptions === undefined
                ? options
                : options.filter(
                      ({ code }) => !hiddenOptions.has(code) || code === value
                  ),
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
        <div ref={box} className="flex flex-col gap-2">
            {visible > RADIO_LIMIT ? (
                <OptionComboInput
                    id={id}
                    offered={offered}
                    value={value}
                    shown={shown}
                    readOnly={readOnly}
                    required={required}
                    pick={onChange}
                />
            ) : (
                <RadioGroup
                    // An empty value checks no radio.
                    value={known ? value : ''}
                    readOnly={readOnly}
                    required={required}
                    onValueChange={(code: string) => onChange(code)}
                >
                    {offered.map(({ code, name }) => (
                        <Label key={code} className="cursor-pointer">
                            <RadioGroupItem value={code} aria-label={name} />
                            {name}
                        </Label>
                    ))}
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
