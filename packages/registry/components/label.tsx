'use client'

import * as React from 'react'
import { cn } from './cn'

// React 18 drops `ref` from function component props; Base UI's FieldLabel passes one.
const Label = React.forwardRef<
    HTMLLabelElement,
    React.ComponentPropsWithoutRef<'label'>
>(({ className, ...props }, ref) => (
    // oxlint-disable-next-line jsx-a11y/label-has-associated-control -- a primitive: callers pass htmlFor or wrap the control
    <label
        ref={ref}
        data-slot="label"
        className={cn(
            'flex items-center gap-2 text-sm leading-[19px] text-dhis2-foreground select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:text-dhis2-disabled-foreground peer-disabled:cursor-not-allowed peer-disabled:text-dhis2-disabled-foreground has-data-disabled:cursor-not-allowed has-data-disabled:text-dhis2-disabled-foreground',
            className
        )}
        {...props}
    />
))
Label.displayName = 'Label'

export { Label }
