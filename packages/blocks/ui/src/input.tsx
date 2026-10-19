import { Input as InputPrimitive } from '@base-ui/react/input'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Input (Base UI) restyled to match @dhis2/ui Input. */
// React 18 drops `ref` from function component props; shadcn targets React 19.
const Input = React.forwardRef<
    HTMLInputElement,
    React.ComponentPropsWithoutRef<'input'>
>(({ className, type, ...props }, ref) => (
    <InputPrimitive
        ref={ref}
        type={type}
        data-slot="input"
        className={cn(
            'h-10 w-full min-w-0 rounded-sm border border-input bg-white px-3 py-[11px] text-sm leading-4 text-grey-900 shadow-[inset_0_0_1px_0_rgb(48_54_60/0.1)] outline-none placeholder:text-grey-600 focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_2px_var(--color-ring)] disabled:cursor-not-allowed disabled:bg-grey-100 disabled:text-grey-600 aria-invalid:border-red-500',
            className
        )}
        {...props}
    />
))
Input.displayName = 'Input'

export { Input }
