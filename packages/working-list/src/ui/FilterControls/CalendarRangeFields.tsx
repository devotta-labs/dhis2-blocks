import { IconCross16 } from '@dhis2/ui-icons'
import React, { useState } from 'react'
import { z } from 'zod'
import { toMultiCalendarIdentifier } from '../../registry/transformers'
import { useWorkingListText } from '../WorkingListText'
import { StrictCalendarInput } from './FilterControlPrimitives'
import styles from './FilterControls.module.css'
import {
    CalendarSelectionSchema,
    type CalendarValidationFeedback,
    type FilterCalendarContext,
    calendarInputDateToCanonical,
    canonicalDateToCalendarInput,
} from './filterValueSupport'

export const CalendarRangeFields = ({
    start,
    end,
    startLabel,
    endLabel,
    calendarContext,
    onChange,
}: {
    start?: string
    end?: string
    startLabel: string
    endLabel: string
    calendarContext: FilterCalendarContext
    onChange: (start: string | undefined, end: string | undefined) => void
}) => {
    const translate = useWorkingListText()
    const calendar = toMultiCalendarIdentifier(calendarContext.calendar)
    const [startValidation, setStartValidation] =
        useState<CalendarValidationFeedback>()
    const [endValidation, setEndValidation] =
        useState<CalendarValidationFeedback>()
    const handleSelection = (
        payload: z.input<typeof CalendarSelectionSchema>,
        otherValue: string | undefined,
        position: 'start' | 'end'
    ) => {
        const selection = CalendarSelectionSchema.parse(payload)
        if (position === 'start') {
            setStartValidation(selection?.validation)
        } else {
            setEndValidation(selection?.validation)
        }
        const selected = calendarInputDateToCanonical(
            selection?.calendarDateString,
            calendarContext.dateFormat
        )
        onChange(
            position === 'start' ? selected : otherValue,
            position === 'end' ? selected : otherValue
        )
    }

    // CalendarInput's own `clearable` renders a boxed "Clear" text button;
    // we render a compact icon inside the input instead. It clears the
    // committed selection along with the visible text (the input syncs to
    // the `date` prop).
    const clearButton = (position: 'start' | 'end') => {
        const validation =
            position === 'start' ? startValidation : endValidation
        return (
            <button
                type="button"
                className={`${styles['calendar-field__clear']}${
                    validation?.error || validation?.warning
                        ? ` ${styles['calendar-field__clear--status-icon']}`
                        : ''
                }`}
                data-test={`date-range-${position}-clear`}
                aria-label={translate('Clear')}
                title={translate('Clear')}
                onClick={() =>
                    handleSelection(
                        null,
                        position === 'start' ? end : start,
                        position
                    )
                }
            >
                <IconCross16 />
            </button>
        )
    }

    return (
        <div
            className={`${styles['range-editor']} ${styles['calendar-range-editor']}`}
        >
            <div className={styles['calendar-field']}>
                <StrictCalendarInput
                    dense
                    strictValidation
                    dataTest="date-range-start"
                    label={startLabel}
                    calendar={calendar}
                    locale={calendarContext.locale}
                    format={calendarContext.dateFormat}
                    error={startValidation?.error}
                    warning={startValidation?.warning}
                    validationText={startValidation?.validationText}
                    date={canonicalDateToCalendarInput(
                        start,
                        calendarContext.dateFormat
                    )}
                    inputWidth="100%"
                    width="min(320px, calc(100vw - 64px))"
                    onDateSelect={(payload) =>
                        handleSelection(payload, end, 'start')
                    }
                />
                {start && clearButton('start')}
            </div>
            <div className={styles['calendar-field']}>
                <StrictCalendarInput
                    dense
                    strictValidation
                    dataTest="date-range-end"
                    label={endLabel}
                    calendar={calendar}
                    locale={calendarContext.locale}
                    format={calendarContext.dateFormat}
                    error={endValidation?.error}
                    warning={endValidation?.warning}
                    validationText={endValidation?.validationText}
                    date={canonicalDateToCalendarInput(
                        end,
                        calendarContext.dateFormat
                    )}
                    inputWidth="100%"
                    width="min(320px, calc(100vw - 64px))"
                    onDateSelect={(payload) =>
                        handleSelection(payload, start, 'end')
                    }
                />
                {end && clearButton('end')}
            </div>
        </div>
    )
}
