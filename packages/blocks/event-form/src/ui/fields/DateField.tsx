import { CalendarInput } from '@dhis2/ui'
import React, {
    createContext,
    useContext,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
    type RefObject,
} from 'react'
import { Input } from '@/registry/dhis2/ui/input'
import { useEventFormFieldContext } from '../EventForm/EventFormContext'
import { CalendarInputBoundary } from './CalendarInputBoundary'
import {
    calendarDateToIso,
    calendarInputDateToCanonical,
    canonicalDateToCalendarInput,
    isoToCalendarDate,
    toMultiCalendarIdentifier,
} from './calendar'
import {
    FieldShell,
    type ControlProps,
    type FieldWidgetProps,
} from './FieldShell'
import { useTypedValue } from './useTypedValue'

type CalendarInputComponent = React.ComponentType<
    React.ComponentProps<typeof CalendarInput>
>

const CalendarInputContext =
    createContext<CalendarInputComponent>(CalendarInput)

/**
 * Swaps the calendar input. `@dhis2/multi-calendar-dates` cannot always resolve Ethiopian eras in
 * the browser's Temporal polyfill, so a test can stand in for the component and still exercise
 * this block's calendar conversion.
 */
export const CalendarInputProvider = ({
    component,
    children,
}: {
    component: CalendarInputComponent
    children: React.ReactNode
}) => (
    <CalendarInputContext.Provider value={component}>
        {children}
    </CalendarInputContext.Provider>
)

/** What `CalendarInput` reports when a date is picked or typed; `null` when it is cleared. */
interface CalendarSelection {
    calendarDateString?: string | null
}

interface DatePickerOptions {
    /** ISO date. */
    value: string | undefined
    onChange(iso: string | undefined): void
    /** An untranslated error key, or `undefined` when the text is fine. */
    onError(error: string | undefined): void
}

/**
 * CalendarInput gives its input an id but no other attributes, so the label, description and
 * invalid state are set on the input directly. Renders nothing.
 */
const InputAttributes = ({
    wrapper,
    control,
}: {
    wrapper: RefObject<HTMLDivElement | null>
    control: ControlProps
}) => {
    const invalid = control['aria-invalid']
    const describedBy = control['aria-describedby']
    const labelledBy = control['aria-labelledby']
    const required = control['aria-required']
    useLayoutEffect(() => {
        const input = wrapper.current?.querySelector('input')
        if (!input) {
            return
        }
        const set = (name: string, attribute: string | undefined) =>
            attribute === undefined
                ? input.removeAttribute(name)
                : input.setAttribute(name, attribute)
        set('aria-describedby', describedBy)
        set('aria-invalid', invalid === undefined ? undefined : 'true')
        set('aria-labelledby', labelledBy)
        set('aria-required', required ? 'true' : undefined)
    }, [wrapper, describedBy, invalid, labelledBy, required])
    return null
}

/**
 * The state of a date in the system calendar, shown in the instance's date format and stored as an
 * ISO date. It commits as soon as a date is picked or a typed one is finished, and an empty text
 * commits `undefined`. A typed date that does not exist is reported through `onError` and not
 * committed.
 *
 * It is a hook and `renderDatePicker` a plain function, not one component, so a widget reaches
 * the input through as few components as possible (the depth budget counts every one).
 */
export const useDatePicker = ({
    value,
    onChange,
    onError,
}: DatePickerOptions) => {
    const { calendar } = useEventFormFieldContext()
    const CalendarInputComponent = useContext(CalendarInputContext)
    const wrapper = useRef<HTMLDivElement>(null)

    // What is typed when the calendar input cannot render.
    const typed = useTypedValue({
        value,
        onCommit: onChange,
        validate: (text) =>
            calendarDateToIso(text, calendar.calendar) === undefined
                ? 'Enter a valid date'
                : undefined,
        format: (iso) => isoToCalendarDate(iso, calendar.calendar) ?? iso,
        parse: (text) => calendarDateToIso(text, calendar.calendar) ?? text,
    })
    useEffect(() => onError(typed.error), [typed.error, onError])

    const handleSelect = (selection: CalendarSelection | null) => {
        const text = selection?.calendarDateString
        if (!text) {
            onError(undefined)
            if (value !== undefined) {
                onChange(undefined)
            }
            return
        }
        const canonical = calendarInputDateToCanonical(
            text,
            calendar.dateFormat
        )
        const iso =
            canonical === undefined
                ? undefined
                : calendarDateToIso(canonical, calendar.calendar)
        if (iso === undefined) {
            onError('Enter a valid date')
            return
        }
        onError(undefined)
        if (iso !== value) {
            onChange(iso)
        }
    }

    const local =
        value === undefined
            ? undefined
            : isoToCalendarDate(value, calendar.calendar)
    return {
        wrapper,
        CalendarInputComponent,
        calendar,
        date: canonicalDateToCalendarInput(local, calendar.dateFormat),
        handleSelect,
        typed,
    }
}

/**
 * The calendar input. If it throws while rendering (its Ethiopian calendar does in some
 * browsers), a text input for `yyyy-MM-dd` in the system calendar takes its place.
 */
export const renderDatePicker = (
    picker: ReturnType<typeof useDatePicker>,
    control: ControlProps,
    disabled: boolean
) => {
    const { CalendarInputComponent, calendar, typed } = picker
    return (
        <div ref={picker.wrapper} className="w-full max-w-72">
            <InputAttributes wrapper={picker.wrapper} control={control} />
            <CalendarInputBoundary
                fallback={
                    <Input
                        {...control}
                        type="text"
                        data-testid="date-text-fallback"
                        placeholder="YYYY-MM-DD"
                        disabled={disabled}
                        value={typed.text}
                        onChange={(event) => typed.onChange(event.target.value)}
                        onBlur={typed.onBlur}
                        onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                                typed.onEnter()
                            }
                        }}
                    />
                }
            >
                <CalendarInputComponent
                    name={control.id}
                    label=""
                    calendar={toMultiCalendarIdentifier(calendar.calendar)}
                    format={calendar.dateFormat}
                    date={picker.date}
                    disabled={disabled}
                    error={control['aria-invalid'] === true}
                    inputWidth="100%"
                    width="min(320px, calc(100vw - 64px))"
                    onDateSelect={picker.handleSelect}
                />
            </CalendarInputBoundary>
        </div>
    )
}

export const DateField = ({ field, onCommit, disabled }: FieldWidgetProps) => {
    const [error, setError] = useState<string>()
    const picker = useDatePicker({
        value: field.value,
        onChange: onCommit,
        onError: setError,
    })
    return (
        <FieldShell field={field} localError={error}>
            {(control) => renderDatePicker(picker, control, disabled)}
        </FieldShell>
    )
}
