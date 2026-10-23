import React, { type ComponentPropsWithoutRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'

/** Internal: a config problem shown in place of a field or a form. */
export function ConfigError({
    className,
    ...props
}: ComponentPropsWithoutRef<'p'>) {
    return (
        <p
            role="alert"
            {...props}
            data-slot="finder-config-error"
            className={cn(
                'm-0 rounded-dhis2-sm border border-dhis2-red-500 bg-dhis2-red-050 px-3 py-2 text-sm text-dhis2-red-900',
                className
            )}
        />
    )
}
