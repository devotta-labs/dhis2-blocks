import i18n from '@dhis2/d2-i18n'
import { CalendarInput } from '@dhis2/ui'
import React, {
    createContext,
    memo,
    useContext,
    useId,
    useLayoutEffect,
} from 'react'
import { Field, FieldControl, FieldLabel } from '@/components/dhis2/ui/field'
import { Input } from '@/components/dhis2/ui/input'
import type { FinderSystemInfo } from '../api/systemInfo'
import {
    calendarDateToIso,
    isIsoDate,
    isoToCalendarDate,
    toMultiCalendarIdentifier,
} from './calendarDates'

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

const NOT_A_DATE = 'not-a-date:'

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

const FieldLink = ({
    inputId,
    describedBy,
    invalid,
}: {
    inputId: string
    describedBy: string | undefined
    invalid: boolean
}) => {
    useLayoutEffect(() => {
        const input = document.getElementById(inputId)
        if (input === null) {
            return
        }
        if (describedBy === undefined) {
            input.removeAttribute('aria-describedby')
        } else {
            input.setAttribute('aria-describedby', describedBy)
        }
        input.setAttribute('aria-invalid', String(invalid))
    }, [inputId, describedBy, invalid])
    return null
}

/**
 * A date typed or picked on the server's calendar, in its date format. The
 * value is kept as ISO. If @dhis2/ui's CalendarInput cannot render the
 * calendar, a plain text input in the same format takes its place.
 */
export const CalendarDateInput = memo(function CalendarDateInput({
    label,
    value,
    onChange,
    info,
    invalid = false,
}: CalendarDateInputProps) {
    const id = useId()
    const CalendarInputComponent = useContext(CalendarInputContext)
    const shown = toShownText(value, info)
    const report = (text: string | null | undefined) =>
        onChange(toFieldValue(text ?? '', info))

    const fallback = (
        <Field invalid={invalid}>
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <Input
                id={id}
                name={id}
                type="text"
                autoComplete="off"
                placeholder={info.dateFormat}
                value={shown}
                onChange={(event) => report(event.target.value)}
            />
        </Field>
    )

    const reportOnEnter = (event: React.KeyboardEvent) => {
        if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
            report(event.target.value)
        }
    }

    return (
        <CalendarErrorBoundary key={info.calendar} fallback={fallback}>
            <div className="contents" onKeyDownCapture={reportOnEnter}>
                <CalendarInputComponent
                    strictValidation
                    label={label}

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
                <FieldControl
                    render={(props) => (
                        <FieldLink
                            inputId={id}
                            describedBy={props['aria-describedby']}
                            invalid={invalid}
                        />
                    )}
                />
            </div>
        </CalendarErrorBoundary>
    )
})
