import { formatDhis2Value } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useHeaderContext, type HeaderContextValue } from '../provider/context'
import { AttributeFact } from './FactPair'
import { TrackedEntityAttribute } from './TrackedEntityAttribute'
import { useLoggedProblem, type AttributeValueState } from './useAttributeValue'

interface BornBase {
    /** Replaces the label. */
    label?: string
    className?: string
}

export type TrackedEntityBornProps =
    | (BornBase & { attribute: string; enrollmentDate?: never })
    | (BornBase & {
          /** The date to show from the person's enrollment in the `program`. */
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
            message: `A tracked entity born part with enrollmentDate "${enrollmentDate}" needs the program prop: the date comes from the person's enrollment in a program`,
        }
    }
    const { metadata, trackedEntity } = state
    const label =
        enrollmentDate === 'occurredAt'
            ? (metadata.incidentDateLabel ?? i18n.t('Date of birth'))
            : (metadata.enrollmentDateLabel ?? i18n.t('Date of enrollment'))
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
}: BornBase & { enrollmentDate: 'occurredAt' | 'enrolledAt' }) => {
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

/** When the person was born: a date attribute, or an enrollment date labelled by the program. */
export function TrackedEntityBorn(props: TrackedEntityBornProps) {
    return props.enrollmentDate ? (
        <FromEnrollment {...props} enrollmentDate={props.enrollmentDate} />
    ) : (
        <TrackedEntityAttribute {...props} attribute={props.attribute ?? ''} />
    )
}
