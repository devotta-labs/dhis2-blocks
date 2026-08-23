import type { QueryClient } from '@tanstack/react-query'
import React from 'react'
import type { ProgramFieldCatalog } from '../../api/metadata'
import { WorkingListContextSchema } from '../../domain/schemas'
import { WorkingListQueryBoundary } from '../WorkingListQueryBoundary'
import {
    WorkingListTextProvider,
    type WorkingListTranslate,
} from '../WorkingListText'
import {
    WorkingListInstance,
    type WorkingListInstanceProps,
} from './WorkingListInstance'

export interface WorkingListProps extends WorkingListInstanceProps {
    translate?: WorkingListTranslate
    queryClient?: QueryClient
}

export const WorkingList = ({
    queryClient,
    translate,
    ...props
}: WorkingListProps) => {
    if (props.program.programType !== 'WITH_REGISTRATION') {
        throw new Error(
            translate?.(
                'Working lists require a tracker program with registration.'
            ) ?? 'Working lists require a tracker program with registration.'
        )
    }
    const context = WorkingListContextSchema.parse({
        orgUnitId: props.orgUnitId,
        programId: props.program.id,
    })

    return (
        <WorkingListQueryBoundary client={queryClient}>
            <WorkingListTextProvider translate={translate}>
                <WorkingListInstance
                    key={props.program.id}
                    {...props}
                    orgUnitId={context.orgUnitId}
                />
            </WorkingListTextProvider>
        </WorkingListQueryBoundary>
    )
}

export type { ProgramFieldCatalog }
