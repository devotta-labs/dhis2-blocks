import React, { useEffect } from 'react'
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
        <p
            role="alert"
            data-slot="finder-metadata-error"
            className={cn(
                'm-0 rounded-dhis2-sm border border-dhis2-red-500 bg-dhis2-red-050 px-3 py-2 text-sm text-dhis2-red-900',
                className
            )}
        >
            {metadataErrorText(message)}
        </p>
    )
}
