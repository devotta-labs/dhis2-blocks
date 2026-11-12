import React, { useEffect } from 'react'
import { Alert } from '@/components/dhis2/ui/alert'
import { cn } from '@/components/dhis2/ui/cn'
import { isProduction } from '../provider/env'
import { metadataErrorText } from './errorText'

/**
 * Internal: a metadata error shown in place of a field or a form. Production
 * shows end users a short message and logs the full one for whoever set the
 * form up.
 */
export function MetadataErrorNotice({
    message,
    className,
}: {
    /** The full setup message. */
    message: string
    className?: string
}) {
    useEffect(() => {
        if (isProduction()) {
            console.error(message)
        }
    }, [message])
    return (
        <Alert
            variant="destructive"
            data-slot="finder-metadata-error"
            className={cn('px-3 py-2', className)}
        >
            {metadataErrorText(message)}
        </Alert>
    )
}
