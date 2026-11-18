import i18n from '@dhis2/d2-i18n'
import { Checkbox } from '@/components/dhis2/ui/checkbox'
import { Input } from '@/components/dhis2/ui/input'
import { Label } from '@/components/dhis2/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/dhis2/ui/radio-group'
import { useId, useState } from 'react'
import type { BooleanControlProps, OptionsControlProps } from './drafts'

/** More options than this get a search input. */
const SEARCH_THRESHOLD = 8

const LIST_CLASS = 'flex max-h-64 flex-col gap-2 overflow-y-auto py-0.5'
const OPTION_CLASS = 'cursor-pointer font-normal'

export const OptionsFilterControl = ({
    filter,
    draft,
    onDraftChange,
}: OptionsControlProps) => {
    const searchId = useId()
    const [search, setSearch] = useState('')
    const query = search.trim().toLowerCase()
    const shown =
        query === ''
            ? filter.options
            : filter.options.filter((option) =>
                  option.label.toLowerCase().includes(query)
              )
    const toggle = (value: string, checked: boolean) =>
        onDraftChange({
            values: checked
                ? [...draft.values.filter((v) => v !== value), value]
                : draft.values.filter((v) => v !== value),
        })
    return (
        <>
            {filter.options.length > SEARCH_THRESHOLD && (
                <div className="flex flex-col gap-1">
                    <Label htmlFor={searchId} className="font-medium">
                        {i18n.t('Search options')}
                    </Label>
                    <Input
                        id={searchId}
                        type="search"
                        value={search}
                        onChange={(event) =>
                            setSearch(event.currentTarget.value)
                        }
                    />
                </div>
            )}
            {shown.length === 0 && (
                <p className="text-sm text-dhis2-muted-foreground">
                    {i18n.t('No options match')}
                </p>
            )}
            {filter.multiple ? (
                <div
                    role="group"
                    aria-label={filter.label}
                    className={LIST_CLASS}
                >
                    {shown.map((option) => (
                        <Label key={option.value} className={OPTION_CLASS}>
                            <Checkbox
                                checked={draft.values.includes(option.value)}
                                onCheckedChange={(checked) =>
                                    toggle(option.value, checked)
                                }
                            />
                            {option.label}
                        </Label>
                    ))}
                </div>
            ) : (
                <RadioGroup<string>
                    aria-label={filter.label}
                    // An empty value checks no radio.
                    value={draft.values[0] ?? ''}
                    onValueChange={(value: string) =>
                        onDraftChange({ values: [value] })
                    }
                    className={LIST_CLASS}
                >
                    {shown.map((option) => (
                        <Label key={option.value} className={OPTION_CLASS}>
                            <RadioGroupItem value={option.value} />
                            {option.label}
                        </Label>
                    ))}
                </RadioGroup>
            )}
        </>
    )
}

const booleanValue = (value: string) => {
    if (value === 'true') return true
    if (value === 'false') return false
    return undefined
}

const booleanText = (value: boolean | undefined) => {
    if (value === undefined) return ''
    return value ? 'true' : 'false'
}

export const BooleanFilterControl = ({
    filter,
    draft,
    onDraftChange,
}: BooleanControlProps) => (
    <RadioGroup<string>
        aria-label={filter.label}
        value={booleanText(draft.value)}
        onValueChange={(value: string) =>
            onDraftChange({ value: booleanValue(value) })
        }
        className={LIST_CLASS}
    >
        <Label className={OPTION_CLASS}>
            <RadioGroupItem value="true" />
            {filter.trueLabel ?? i18n.t('Yes')}
        </Label>
        <Label className={OPTION_CLASS}>
            <RadioGroupItem value="false" />
            {filter.falseLabel ?? i18n.t('No')}
        </Label>
    </RadioGroup>
)
