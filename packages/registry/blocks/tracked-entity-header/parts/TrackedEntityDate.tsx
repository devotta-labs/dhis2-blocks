import { formatDhis2Value } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useHeaderContext, type HeaderContextValue } from '../provider/context'
import { AttributeFact } from './FactPair'
import { TrackedEntityAttribute } from './TrackedEntityAttribute'
import { useLoggedProblem, type AttributeValueState } from './useAttributeValue'

interface DateBase {
    /** Replaces the label. */
    label?: string
    className?: string
}

export type TrackedEntityDateProps =
    | (DateBase & { attribute: string; enrollmentDate?: never })
    | (DateBase & {
          /** The date to show from the enrollment in the `program`. */
          enrollmentDate: 'occurredAt' | 'enrolledAt'
          attribute?: never
      })

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
    label,
    className,
}: DateBase & { enrollmentDate: 'occurredAt' | 'enrolledAt' }) => {
    const context = useHeaderContext()
    const result = resolveEnrollmentDate(enrollmentDate, context)
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

/** A date of the record: a date attribute, or an enrollment date labelled by the program. */
export function TrackedEntityDate(props: TrackedEntityDateProps) {
    return props.enrollmentDate ? (
        <FromEnrollment {...props} enrollmentDate={props.enrollmentDate} />
    ) : (
        <TrackedEntityAttribute {...props} attribute={props.attribute ?? ''} />
    )
}
