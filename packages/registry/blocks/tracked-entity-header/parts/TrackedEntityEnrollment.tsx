import { formatDhis2Value } from '@/components/dhis2-value-display'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useHeaderContext } from '../provider/context'
import { AttributeFact } from './FactPair'
import { useLoggedProblem } from './useAttributeValue'

export interface TrackedEntityEnrollmentProps {
    className?: string
}

const MISSING_PROGRAM =
    "A tracked entity enrollment part needs the program prop: the enrollment is the person's enrollment in a program"

/** Where the person stands in the program: active since, completed, cancelled or not enrolled. */
export function TrackedEntityEnrollment({
    className,
}: TrackedEntityEnrollmentProps) {
    const { state, program, display } = useHeaderContext()
    const problem = program ? undefined : MISSING_PROGRAM
    useLoggedProblem(problem)
    if (state.status !== 'ready') {
        return null
    }
    if (problem) {
        return (
            <AttributeFact
                state={{ kind: 'misconfigured', message: problem }}
            />
        )
    }
    const enrollment = state.trackedEntity.enrollment
    const when = (iso?: string) =>
        iso ? formatDhis2Value(iso, { valueType: 'DATE' }, display) : undefined
    const completedOn = when(enrollment?.completedAt)
    const since = when(enrollment?.enrolledAt)
    const text = (() => {
        switch (enrollment?.status) {
            case undefined:
                return i18n.t('Not enrolled')
            case 'CANCELLED':
                return i18n.t('Cancelled')
            case 'COMPLETED':
                return completedOn
                    ? i18n.t('Completed {{date}}', { date: completedOn })
                    : i18n.t('Completed')
            default:
                return since
                    ? i18n.t('Active since {{date}}', { date: since })
                    : i18n.t('Active')
        }
    })()
    return (
        <AttributeFact
            state={{ kind: 'value', label: '', text }}
            className={className}
        />
    )
}
