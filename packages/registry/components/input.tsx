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
            'h-10 w-full min-w-0 rounded-dhis2-sm border border-dhis2-input bg-dhis2-background px-3 py-[11px] text-sm leading-4 text-dhis2-foreground shadow-[inset_0_0_1px_0_color-mix(in_srgb,var(--dhis2-foreground)_10%,transparent)] outline-none placeholder:text-dhis2-subtle-foreground focus-visible:border-dhis2-ring focus-visible:shadow-[inset_0_0_0_2px_var(--dhis2-ring)] forced-colors:focus-visible:outline-2 forced-colors:focus-visible:outline-solid forced-colors:focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:bg-dhis2-muted disabled:text-dhis2-disabled-foreground aria-invalid:border-dhis2-destructive-border',
            className
        )}
        {...props}
    />
))
Input.displayName = 'Input'

export { Input }
