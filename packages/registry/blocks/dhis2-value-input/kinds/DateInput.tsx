import i18n from '@dhis2/d2-i18n'
import { IconCalendar16 } from '@dhis2/ui-icons'
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { storedTime } from '@/components/dhis2-value-display'
import { parseTyped, typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
} from '@/components/dhis2/ui/input-group'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import type { useDraft } from '../useDraft'
import { DatePicker } from './DatePicker'
import { calendarOf } from './ownCalendar'
import { TypedInput } from './TypedInput'

/** How a date, or a date and time, is typed in the system date format, as the data entry grid says it too. */
export const dateFormatHint = (
    kind: 'date' | 'dateTime',
    { dateFormat }: ValueSettings
) =>
    i18n.t('Date format: {{format}}', {
        nsSeparator: '::',
        format: kind === 'date' ? dateFormat : `${dateFormat} HH:mm`,
    })

const DAY: Field = { valueType: 'DATE' }

/** The direction the page sets around an element, if any: not the element's own, as a date's text is always `ltr`. */
const directionOf = (element: Element | null) => {
    const dir = element?.parentElement?.closest('[dir]')?.getAttribute('dir')
    return dir === 'rtl' || dir === 'ltr' ? dir : undefined
}

/**
 * The button in a typed date's box that opens a calendar to choose the day from, as Down Arrow in `input` does too.
 * `date` is the day shown as picked, typed in the system calendar and date format, or empty for none; `pick` is given
 * the day chosen, typed so too. Focus goes back to `input` when the calendar closes.
 */
export const DatePickerButton = ({
    input,
    date,
    settings,
    pick,
}: {
    input: RefObject<HTMLInputElement>
    date: string
    settings: ValueSettings
    pick(text: string): void
}) => {
    const day = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [dir, setDir] = useState<'ltr' | 'rtl'>()
    const show = (next: boolean) => {
        setDir(directionOf(input.current))
        setOpen(next)
    }
    useEffect(() => {
        const element = input.current
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'ArrowDown') {
                event.preventDefault()
                show(true)
            }
        }
        element?.addEventListener('keydown', onKeyDown)
        return () => element?.removeEventListener('keydown', onKeyDown)
    }, [input])
    return (
        <Popover open={open} onOpenChange={show}>
            <PopoverTrigger
                render={<InputGroupButton variant="ghost" size="icon-xs" />}
                aria-label={i18n.t('Choose date')}
                // A press opens the calendar without taking focus from the input, whose text is not committed half typed.
                onMouseDown={(event) => event.preventDefault()}
            >
                <IconCalendar16 />
            </PopoverTrigger>
            <PopoverContent
                // Under the whole box the button sits in, not under the button.
                anchor={() =>
                    input.current?.closest('[data-slot=input-group]') ??
                    input.current
                }
                align="start"
                initialFocus={day}
                finalFocus={input}
                className="w-auto"
            >
                <div ref={calendarOf(input)} data-slot="date-calendar">
                    <DatePicker
                        date={date}
                        settings={settings}
                        day={day}
                        dir={dir}
                        pick={(picked) => {
                            setOpen(false)
                            pick(picked)
                        }}
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}

/**
 * A date, or a date and time, typed in the system calendar and date format, with a calendar to choose the day from. A
 * day chosen fills the input and is reported at once; for a date and time it keeps the time typed, and waits for one
 * when there is none yet.
 */
export const DateInput = ({
    id,
    field,
    settings,
    draft,
    readOnly,
    required,
    className,
}: {
    id: string
    field: Field
    settings: ValueSettings
    draft: ReturnType<typeof useDraft>
    readOnly: boolean
    required: boolean
    className?: string
}) => {
    const input = useRef<HTMLInputElement>(null)
    const typed = parseTyped(field, draft.text, settings)
    const stored = typed.ok ? typed.value : undefined
    // The time typed, also beside a date that is not one yet, or with no date at all.
    const time =
        stored === undefined
            ? draft.text.match(/\b\d{1,2}:\d{2}\b/)?.[0]
            : storedTime(stored)
    const withTime = field.valueType === 'DATETIME'
    if (readOnly) {
        return (
            <TypedInput
                id={id}
                field={field}
                draft={draft}
                readOnly
                required={required}
                className={className}
            />
        )
    }
    return (
        <InputGroup className={className}>
            <TypedInput
                id={id}
                inputRef={input}
                field={field}
                draft={draft}
                readOnly={false}
                required={required}
                grouped
            />
            <InputGroupAddon align="inline-end">
                <DatePickerButton
                    input={input}
                    date={
                        stored === undefined
                            ? ''
                            : typedText(DAY, stored, settings)
                    }
                    settings={settings}
                    pick={(picked) => {
                        draft.change(
                            withTime ? `${picked} ${time ?? ''}` : picked
                        )
                        if (!withTime || time !== undefined) {
                            draft.commit()
                        }
                    }}
                />
            </InputGroupAddon>
        </InputGroup>
    )
}
