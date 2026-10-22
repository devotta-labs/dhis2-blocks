'use client'

import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Radio Group (Base UI) laid out as a vertical stack of radios. */
function RadioGroup<Value>({
    className,
    ...props
}: RadioGroupPrimitive.Props<Value>) {
    return (
        <RadioGroupPrimitive
            data-slot="radio-group"
            className={cn('grid w-full gap-2', className)}
            {...props}
        />
    )
}

/** A 16px radio: a grey ring that fills with the primary colour when checked. */
function RadioGroupItem<Value>({
    className,
    ...props
}: RadioPrimitive.Root.Props<Value>) {
    return (
        <RadioPrimitive.Root
            data-slot="radio-group-item"
            className={cn(
                'peer relative flex aspect-square size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dhis2-input bg-white outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-offset-1 focus-visible:outline-dhis2-ring data-checked:border-dhis2-primary data-checked:bg-dhis2-primary data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-dhis2-red-500',
                className
            )}
            {...props}
        >
            <RadioPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="flex items-center justify-center"
            >
                <span className="size-1.5 rounded-full bg-dhis2-primary-foreground" />
            </RadioPrimitive.Indicator>
        </RadioPrimitive.Root>
    )
}

export { RadioGroup, RadioGroupItem }
