'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'
import { IconCheckmark16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Checkbox (Base UI) restyled to match @dhis2/ui Checkbox. */
function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                'peer relative flex size-[18px] shrink-0 cursor-pointer items-center justify-center rounded-[3px] border-2 border-grey-800 bg-white text-white outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-ring data-checked:border-teal-900 data-checked:bg-teal-500 data-disabled:cursor-not-allowed data-disabled:border-grey-400 data-disabled:bg-white data-disabled:data-checked:bg-grey-400 aria-invalid:border-red-500',
                className
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="grid place-content-center text-current transition-none [&>svg]:size-3.5 [&>svg]:fill-current"
            >
                <IconCheckmark16 />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    )
}

export { Checkbox }
