import { formatDhis2Value } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { ageOf, formatAge, todayIso } from '../format/age'
import { useHeaderContext, type HeaderContextValue } from '../provider/context'
import { AttributeFact } from './FactPair'
import {
    useAttributeValue,
    useLoggedProblem,
    type AttributeValueState,
} from './useAttributeValue'

interface DateBase {
    /** Replaces the label. */
    label?: string
    /** Shows the time from this date to today beside it: days under one month, months under two years, years after. */
    age?: boolean
    className?: string
}

export type TrackedEntityDateProps =
    | (DateBase & {
          attribute: string
          enrollmentDate?: never
      })
    | (DateBase & {
          /** The date to show from the enrollment in the `program`. */
          enrollmentDate: 'occurredAt' | 'enrolledAt'
          attribute?: never
      })

/** The value with its age appended, when asked for and the raw date gives one. */
const withAge = (
    state: AttributeValueState,
    raw: string | undefined,
    { display }: HeaderContextValue
): AttributeValueState => {
    const ageNow = raw ? ageOf(raw, todayIso(), display.calendar) : undefined
    return state.kind === 'value' && ageNow
        ? {
              ...state,
              text: i18n.t('{{date}} ({{age}})', {
                  date: state.text,
                  age: formatAge(ageNow),
                  interpolation: { escapeValue: false },
              }),
          }
        : state
}

const resolveEnrollmentDate = (
    enrollmentDate: 'occurredAt' | 'enrolledAt',
    { state, program, display }: HeaderContextValue
): AttributeValueState => {
    if (state.status !== 'ready') {
        return { kind: 'hidden' }
    }
    if (!program) {
        return {
            kind: 'misconfigured',
            message: `A tracked entity date part with enrollmentDate "${enrollmentDate}" needs the program prop: the date comes from the enrollment in a program`,
        }
    }
    const { metadata, trackedEntity } = state
    const label =
        enrollmentDate === 'occurredAt'
            ? (metadata.incidentDateLabel ?? i18n.t('Incident date'))
            : (metadata.enrollmentDateLabel ?? i18n.t('Enrollment date'))
    const raw = trackedEntity.enrollment?.[enrollmentDate]
    if (!raw) {
        return { kind: 'missing', label }
    }
    const text = formatDhis2Value(raw, { valueType: 'DATE' }, display)
    return { kind: 'value', label, text }
}

const FromEnrollment = ({
    enrollmentDate,
    age,
    label,
    className,
}: DateBase & { enrollmentDate: 'occurredAt' | 'enrolledAt' }) => {
    const context = useHeaderContext()
    const resolved = resolveEnrollmentDate(enrollmentDate, context)
    const result =
        age && context.state.status === 'ready'
            ? withAge(
                  resolved,
                  context.state.trackedEntity.enrollment?.[enrollmentDate],
                  context
              )
            : resolved
    useLoggedProblem(
        result.kind === 'misconfigured' ? result.message : undefined
    )
    return (
        <AttributeFact
            state={result}
            label={label || undefined}
            className={className}
        />
    )
}

const FromAttribute = ({
    attribute,
    age,
    label,
    className,
}: DateBase & { attribute: string }) => {
    const context = useHeaderContext()
    const state = useAttributeValue(attribute)
    const shown =
        age && context.state.status === 'ready'
            ? withAge(
                  state,
                  context.state.trackedEntity.values.get(attribute),
                  context
              )
            : state
    return (
        <AttributeFact
            state={shown}
            label={label || undefined}
            className={className}
        />
    )
}

/** A date of the record: a date attribute, or an enrollment date labelled by the program. */
export function TrackedEntityDate(props: TrackedEntityDateProps) {
    return props.enrollmentDate ? (
        <FromEnrollment {...props} enrollmentDate={props.enrollmentDate} />
    ) : (
        <FromAttribute {...props} attribute={props.attribute ?? ''} />
    )
}
