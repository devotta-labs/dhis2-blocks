import { CalendarInput } from '@dhis2/ui'
import React, {
    createContext,
    useContext,
    useLayoutEffect,
    useRef,
    useState,
} from 'react'
import { useEventFormFieldContext } from '../EventForm/EventFormContext'
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

/**
 * A date in the system calendar, shown in the instance's date format and stored as an ISO date.
 * It commits as soon as a date is picked or a typed one is finished, and an empty text commits
 * `undefined`. A typed date that does not exist is reported through `onError` and not committed.
 */
export const DatePicker = ({
    control,
    value,
    disabled,
    onChange,
    onError,
}: {
    control: ControlProps
    /** ISO date. */
    value: string | undefined
    disabled: boolean
    onChange(iso: string | undefined): void
    /** An untranslated error key, or `undefined` when the text is fine. */
    onError(error: string | undefined): void
}) => {
    const { calendar } = useEventFormFieldContext()
    const CalendarInputComponent = useContext(CalendarInputContext)
    const wrapper = useRef<HTMLDivElement>(null)
    const invalid = control['aria-invalid']
    const describedBy = control['aria-describedby']

    // CalendarInput gives its input an id but no other attributes, so the description and the
    // invalid state are set on the input directly.
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
        set('aria-labelledby', control['aria-labelledby'])
        set('aria-required', control['aria-required'] ? 'true' : undefined)
    }, [describedBy, invalid, control])

    const local =
        value === undefined
            ? undefined
            : isoToCalendarDate(value, calendar.calendar)

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

    return (
        <div ref={wrapper} className="w-full max-w-72">
            <CalendarInputComponent
                name={control.id}
                label=""
                calendar={toMultiCalendarIdentifier(calendar.calendar)}
                format={calendar.dateFormat}
                date={canonicalDateToCalendarInput(local, calendar.dateFormat)}
                disabled={disabled}
                error={invalid === true}
                inputWidth="100%"
                width="min(320px, calc(100vw - 64px))"
                onDateSelect={handleSelect}
            />
        </div>
    )
}

export const DateField = ({ field, onCommit, disabled }: FieldWidgetProps) => {
    const [error, setError] = useState<string>()
    return (
        <FieldShell field={field} localError={error}>
            {(control) => (
                <DatePicker
                    control={control}
                    value={field.value}
                    disabled={disabled}
                    onChange={onCommit}
                    onError={setError}
                />
            )}
        </FieldShell>
    )
}
