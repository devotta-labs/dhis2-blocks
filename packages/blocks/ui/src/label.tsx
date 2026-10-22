'use client'

import * as React from 'react'
import { cn } from './cn'

function Label({ className, ...props }: React.ComponentProps<'label'>) {
    return (
        <label
            data-slot="label"
            className={cn(
                'flex items-center gap-2 text-sm leading-[19px] text-dhis2-grey-900 select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-dhis2-grey-600 peer-disabled:cursor-not-allowed peer-disabled:text-dhis2-grey-600 has-data-disabled:cursor-not-allowed has-data-disabled:text-dhis2-grey-600',
                className
            )}
            {...props}
        />
    )
}

export { Label }
