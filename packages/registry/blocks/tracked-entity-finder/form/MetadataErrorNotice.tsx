import React from 'react'
import { Alert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'

/** Internal: a metadata error shown in place of a field or a form. */
export function MetadataErrorNotice({
    className,
    ...props
}: Omit<React.ComponentProps<typeof Alert>, 'variant'>) {
    return (
        <Alert
            variant="destructive"
            {...props}
            data-slot="finder-metadata-error"
            className={cn('px-3 py-2', className)}
        />
    )
}
