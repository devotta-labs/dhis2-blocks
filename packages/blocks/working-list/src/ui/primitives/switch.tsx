'use client'

import { Switch as SwitchPrimitive } from '@base-ui/react/switch'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Switch (Base UI) restyled to match @dhis2/ui Switch. */
function Switch({
    className,
    size = 'default',
    ...props
}: SwitchPrimitive.Root.Props & {
    size?: 'sm' | 'default'
}) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            data-size={size}
            className={cn(
                'peer group/switch relative inline-flex shrink-0 cursor-pointer items-center rounded-full border border-grey-600 outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring data-[size=default]:h-[18px] data-[size=default]:w-[35px] data-[size=sm]:h-[14px] data-[size=sm]:w-[27px] data-checked:border-teal-700 data-checked:bg-teal-400 data-unchecked:bg-grey-600 data-disabled:cursor-not-allowed data-disabled:border-grey-400 data-disabled:bg-grey-300',
                className
            )}
            {...props}
        >
            <SwitchPrimitive.Thumb
                data-slot="switch-thumb"
                className="pointer-events-none block rounded-full bg-white ring-0 transition-transform group-data-[size=default]/switch:size-3.5 group-data-[size=sm]/switch:size-2.5 data-checked:translate-x-[calc(100%+3px)] data-unchecked:translate-x-0.5"
            />
        </SwitchPrimitive.Root>
    )
}

export { Switch }
