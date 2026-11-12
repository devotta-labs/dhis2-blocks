import { Badge } from '@/components/dhis2/ui/badge'
import { cn } from '@/components/dhis2/ui/cn'
import i18n from '@dhis2/d2-i18n'
import React from 'react'
import { useTrackedEntityHeader } from '../hooks'

export interface TrackedEntityStatusProps {
    className?: string
}

/** Words for the tracked entity's flags: Inactive, Possible duplicate. Nothing when neither applies. */
export function TrackedEntityStatus({ className }: TrackedEntityStatusProps) {
    const header = useTrackedEntityHeader()
    if (header.status !== 'ready') {
        return null
    }
    const { inactive, potentialDuplicate } = header.trackedEntity
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
