import { Badge } from '@/components/dhis2/ui/badge'
import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useHeaderContext } from '../provider/context'

export interface TrackedEntityStatusProps {
    className?: string
}

/** Words for the person's flags: Inactive, Possible duplicate. Nothing when neither applies. */
export function TrackedEntityStatus({ className }: TrackedEntityStatusProps) {
    const { state } = useHeaderContext()
    if (state.status !== 'ready') {
        return null
    }
    const { inactive, potentialDuplicate } = state.trackedEntity
    if (!inactive && !potentialDuplicate) {
        return null
    }
    return (
        <span
            data-slot="tracked-entity-status"
            className={cn('inline-flex flex-wrap gap-1.5', className)}
        >
            {inactive && <Badge variant="outline">{i18n.t('Inactive')}</Badge>}
            {potentialDuplicate && (
                <Badge variant="outline">{i18n.t('Possible duplicate')}</Badge>
            )}
        </span>
    )
}
