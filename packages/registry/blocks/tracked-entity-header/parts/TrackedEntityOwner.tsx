import { Skeleton } from '@/components/dhis2/ui/skeleton'
import i18n from '@dhis2/d2-i18n'
import { useQuery } from '@tanstack/react-query'
import { Result } from 'better-result'
import React from 'react'
import { shouldRetryTrackedEntityHeaderRequest } from '../api/client'
import { fetchOrgUnitName } from '../api/queries'
import { trackedEntityHeaderQueryKeys } from '../api/queryKeys'
import { useHeaderContext } from '../provider/context'
import { AttributeFact } from './FactPair'
import { useLoggedProblem } from './useAttributeValue'

export interface TrackedEntityOwnerProps {
    className?: string
}

const MISSING_PROGRAM =
    "A tracked entity owner part needs the program prop: the owner is the person's owner for a program"

const OwnerName = ({
    orgUnit,
    className,
}: {
    orgUnit?: string
    className?: string
}) => {
    const { resourceClient, clientId } = useHeaderContext()
    const query = useQuery({
        queryKey: trackedEntityHeaderQueryKeys.orgUnit(clientId, orgUnit ?? ''),
        queryFn: async ({ signal }) => {
            const result = await fetchOrgUnitName(
                resourceClient,
                orgUnit ?? '',
                signal
            )
            if (Result.isError(result)) {
                throw result.error
            }
            return result.value
        },
        enabled: orgUnit !== undefined,
        retry: shouldRetryTrackedEntityHeaderRequest,
    })
    if (orgUnit === undefined) {
        return (
            <AttributeFact
                state={{ kind: 'missing', label: i18n.t('Owned by') }}
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
                state={{ kind: 'unavailable', label: i18n.t('Owned by') }}
                className={className}
            />
        )
    }
    return (
        <AttributeFact
            state={{
                kind: 'value',
                label: '',
                text: i18n.t('Owned by {{orgUnit}}', {
                    orgUnit: query.data,
                    interpolation: { escapeValue: false },
                }),
            }}
            className={className}
        />
    )
}

/** The organisation unit that owns the person's record in the program. */
export function TrackedEntityOwner({ className }: TrackedEntityOwnerProps) {
    const { state, program } = useHeaderContext()
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
    return (
        <OwnerName
            orgUnit={state.trackedEntity.ownerOrgUnit}
            className={className}
        />
    )
}
