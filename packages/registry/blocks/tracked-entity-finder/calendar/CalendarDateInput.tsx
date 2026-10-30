import i18n from '@dhis2/d2-i18n'
import { CalendarInput } from '@dhis2/ui'
import React, { createContext, useContext, useId } from 'react'
import { Field, FieldLabel } from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import type { FinderSystemInfo } from '../api/systemInfo'
import {
    calendarDateToIso,
    isIsoDate,
    isoToCalendarDate,
    toMultiCalendarIdentifier,
} from './calendarDates'

// CalendarInput supports this at runtime (and documents it in PropTypes), but
// its declaration bundle may omit the prop.
export type StrictCalendarInputProps = React.ComponentProps<
    typeof CalendarInput
> & {
    strictValidation?: boolean
}

const CalendarInputContext =
    createContext<React.ComponentType<StrictCalendarInputProps>>(CalendarInput)

/** Swaps the calendar input the finder renders, e.g. for a stand-in in tests. */
export const CalendarInputProvider = ({
    component,
    children,
}: {
    component: React.ComponentType<StrictCalendarInputProps>
    children: React.ReactNode
}) => (
    <CalendarInputContext.Provider value={component}>
        {children}
    </CalendarInputContext.Provider>
)

// Marks typed text that is not a date on the system calendar but would read
// as a real ISO date (e.g. Ethiopian 2017-01-31), so it can never be searched.
const NOT_A_DATE = 'not-a-date:'

/** What the field holds for what the user typed: ISO, '' or the text. */
const toFieldValue = (text: string, info: FinderSystemInfo) => {
    if (text.trim() === '') {
        return ''
    }
    const iso = calendarDateToIso(text, info)
    if (iso) {
        return iso
    }
    return isIsoDate(text) ? `${NOT_A_DATE}${text}` : text
}

/** What the input shows for what the field holds. */
const toShownText = (value: string, info: FinderSystemInfo) =>
    value.startsWith(NOT_A_DATE)
        ? value.slice(NOT_A_DATE.length)
        : isoToCalendarDate(value, info)

class CalendarErrorBoundary extends React.Component<
    { fallback: React.ReactNode; children: React.ReactNode },
    { failed: boolean }
> {
    state = { failed: false }

    static getDerivedStateFromError() {
        return { failed: true }
    }

    componentDidCatch(error: Error) {
        console.warn(
            'CalendarInput failed on this calendar; using a plain date input.',
            error
        )
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children
    }
}

export interface CalendarDateInputProps {
    label: string
    /** An ISO date, or text that is not a date. */
    value: string
    /** An ISO date, '' when cleared, or the text when it is not a date. */
    onChange: (next: string) => void
    info: FinderSystemInfo
    /** Marks the input invalid; the caller shows why. */
    invalid?: boolean
}

/**
 * A date typed or picked on the server's calendar, in its date format. The
 * value is kept as ISO. If @dhis2/ui's CalendarInput cannot render the
 * calendar, a plain text input in the same format takes its place.
 */
export const CalendarDateInput = ({
    label,
    value,
    onChange,
    info,
    invalid = false,
}: CalendarDateInputProps) => {
    const id = useId()
    const CalendarInputComponent = useContext(CalendarInputContext)
    const shown = toShownText(value, info)
    const report = (text: string | null | undefined) =>
        onChange(toFieldValue(text ?? '', info))

    const fallback = (
        <Field>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                name={id}
                type="text"
                autoComplete="off"
                placeholder={info.dateFormat}
                aria-invalid={invalid || undefined}
                value={shown}
                onChange={(event) => report(event.target.value)}
            />
        </Field>
    )

    // CalendarInput reports typed text only on blur, but Enter submits the
    // form first: report it before the submit, or the search drops the date.
    const reportOnEnter = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            report(event.target.value)
        }
    }

    return (
        // A new calendar gets a fresh try at CalendarInput.
        <CalendarErrorBoundary key={info.calendar} fallback={fallback}>
            <div className="contents" onKeyDownCapture={reportOnEnter}>
                <CalendarInputComponent
                    dense
                    strictValidation
                    label={label}
                    // CalendarInput gives the input this id and points its label at it.
                    name={id}
                    calendar={toMultiCalendarIdentifier(info.calendar)}
                    locale={i18n.language}
                    format={info.dateFormat}
                    date={shown}
                    inputWidth="100%"
                    error={invalid}
                    onDateSelect={(selection) =>
                        report(selection?.calendarDateString)
                    }
                />
            </div>
        </CalendarErrorBoundary>
    )
}
