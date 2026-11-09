import i18n from '@dhis2/d2-i18n'
import { IconCalendar16 } from '@dhis2/ui-icons'
import { useRef, useState } from 'react'
import { storedTime } from '@/components/dhis2-value-display'
import { parseTyped, typedText } from '@/components/dhis2-value-types'
import type { Field, ValueSettings } from '@/components/dhis2-value-types'
import { Button } from '@/components/dhis2/ui/button'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import type { useDraft } from '../useDraft'
import { DatePicker } from './DatePicker'
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

/** The direction the page sets around an element, if any. */
const directionOf = (element: Element | null) => {
    const dir = element?.closest('[dir]')?.getAttribute('dir')
    return dir === 'rtl' || dir === 'ltr' ? dir : undefined
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
}: {
    id: string
    field: Field
    settings: ValueSettings
    draft: ReturnType<typeof useDraft>
    readOnly: boolean
    required: boolean
}) => {
    const input = useRef<HTMLInputElement>(null)
    const day = useRef<HTMLButtonElement>(null)
    const [open, setOpen] = useState(false)
    const [dir, setDir] = useState<'ltr' | 'rtl'>()
    const typed = parseTyped(field, draft.text, settings)
    const stored = typed.ok ? typed.value : undefined
    const time = stored === undefined ? undefined : storedTime(stored)
    const withTime = field.valueType === 'DATETIME'
    return (
        <div className="flex gap-2">
            <TypedInput
                id={id}
                inputRef={input}
                field={field}
                draft={draft}
                readOnly={readOnly}
                required={required}
            />
            {readOnly ? null : (
                <Popover
                    open={open}
                    onOpenChange={(next) => {
                        setDir(directionOf(input.current))
                        setOpen(next)
                    }}
                >
                    <PopoverTrigger
                        render={
                            <Button
                                variant="secondary"
                                size="icon"
                                className="size-10"
                            />
                        }
                        aria-label={i18n.t('Choose date')}
                    >
                        <IconCalendar16 />
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        initialFocus={day}
                        finalFocus={input}
                        className="w-auto"
                    >
                        <DatePicker
                            date={
                                stored === undefined
                                    ? ''
                                    : typedText(DAY, stored, settings)
                            }
                            settings={settings}
                            day={day}
                            dir={dir}
                            pick={(picked) => {
                                setOpen(false)
                                draft.change(
                                    withTime
                                        ? `${picked} ${time ?? ''}`
                                        : picked
                                )
                                if (!withTime || time !== undefined) {
                                    draft.commit()
                                }
                            }}
                        />
                    </PopoverContent>
                </Popover>
            )}
        </div>
    )
}
