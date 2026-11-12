import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useOrgUnitName } from '../api/queries'
import { useTrackedEntityHeader } from '../hooks'
import { useHeaderContext } from '../provider/context'
import { AttributeFact } from './FactPair'
import { useLoggedProblem } from './useAttributeValue'

export interface TrackedEntityOwnerProps {
    /** Shows the owner as this label and the unit's name, in place of "Owned by …". */
    label?: string
    className?: string
}

const MISSING_PROGRAM =
    'A tracked entity owner part needs the program prop: the owner is the owner for a program'

const OwnerName = ({
    orgUnit,
    label,
    className,
}: {
    orgUnit?: string
    label?: string
    className?: string
}) => {
    const query = useOrgUnitName(orgUnit)
    if (orgUnit === undefined) {
        return (
            <AttributeFact
                state={{
                    kind: 'missing',
                    label: label || i18n.t('Owned by'),
                }}
                className={className}
            />
        )
    }
    if (query.isPending) {
        return <Skeleton className="h-5 w-40" />
    }
    if (query.data === undefined) {
        return (
            <AttributeFact
                state={{
                    kind: 'unavailable',
                    label: label || i18n.t('Owned by'),
                }}
                className={className}
            />
        )
    }
    return (
        <AttributeFact
            state={
                label
                    ? { kind: 'value', label, text: query.data }
                    : {
                          kind: 'value',
                          label: '',
                          text: i18n.t('Owned by {{orgUnit}}', {
                              orgUnit: query.data,
                              interpolation: { escapeValue: false },
                          }),
                      }
            }
            className={className}
        />
    )
}

/** The organisation unit that owns the record in the program. */
export function TrackedEntityOwner({
    label,
    className,
}: TrackedEntityOwnerProps) {
    const { program } = useHeaderContext()
    const header = useTrackedEntityHeader()
    const problem = program ? undefined : MISSING_PROGRAM
    useLoggedProblem(problem)
    if (header.status !== 'ready') {
        return null
    }
    if (problem) {
        return (
            <AttributeFact
                state={{ kind: 'misconfigured', message: problem }}
            />
        )
    }
    return (
        <OwnerName
            orgUnit={header.trackedEntity.ownerOrgUnit}
            label={label}
            className={className}
        />
    )
}
