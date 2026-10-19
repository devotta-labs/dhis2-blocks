'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/**
 * shadcn Toggle (Base UI) restyled with DHIS2 tokens. `outline` matches the
 * outline Button at rest; pressed swaps to a blue-tinted fill and border.
 */
const toggleVariants = cva(
    "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border text-sm leading-4 font-normal tracking-[0.5px] whitespace-nowrap outline-none select-none focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring disabled:cursor-not-allowed disabled:text-grey-600 data-pressed:border-blue-600 data-pressed:bg-blue-050 data-pressed:font-medium data-pressed:text-blue-800 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    'border-transparent bg-transparent text-grey-900 hover:bg-grey-200',
                outline:
                    'border-grey-400 bg-white text-grey-900 hover:bg-grey-100 data-pressed:hover:bg-blue-100',
            },
            size: {
                default: 'h-9 px-3',
                sm: 'h-8 px-2.5',
                lg: 'h-10 px-4',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

// React 18 drops `ref` from function component props; shadcn targets React 19.
const Toggle = React.forwardRef<
    HTMLButtonElement,
    TogglePrimitive.Props & VariantProps<typeof toggleVariants>
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <TogglePrimitive
        ref={ref}
        data-slot="toggle"
        className={cn(toggleVariants({ variant, size, className }))}
        {...props}
    />
))
Toggle.displayName = 'Toggle'

export { Toggle, toggleVariants }
