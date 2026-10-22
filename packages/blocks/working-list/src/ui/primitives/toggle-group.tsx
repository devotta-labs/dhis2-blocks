'use client'

import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import { type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'
import { toggleVariants } from './toggle'

/**
 * shadcn Toggle Group (Base UI). Items take the group's variant and size
 * unless they set their own. Items are spaced apart rather than joined.
 */
const ToggleGroupContext = React.createContext<
    VariantProps<typeof toggleVariants>
>({
    variant: 'default',
    size: 'default',
})

function ToggleGroup<Value extends string>({
    className,
    variant,
    size,
    children,
    ...props
}: ToggleGroupPrimitive.Props<Value> & VariantProps<typeof toggleVariants>) {
    return (
        <ToggleGroupPrimitive
            data-slot="toggle-group"
            data-variant={variant}
            data-size={size}
            className={cn(
                'flex w-fit flex-wrap items-center gap-1 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
                className
            )}
            {...props}
        >
            <ToggleGroupContext.Provider value={{ variant, size }}>
                {children}
            </ToggleGroupContext.Provider>
        </ToggleGroupPrimitive>
    )
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const ToggleGroupItem = React.forwardRef<
    HTMLButtonElement,
    TogglePrimitive.Props & VariantProps<typeof toggleVariants>
>(({ className, variant, size, ...props }, ref) => {
    const context = React.useContext(ToggleGroupContext)
    return (
        <TogglePrimitive
            ref={ref}
            data-slot="toggle-group-item"
            className={cn(
                toggleVariants({
                    variant: variant ?? context.variant,
                    size: size ?? context.size,
                }),
                className
            )}
            {...props}
        />
    )
})
ToggleGroupItem.displayName = 'ToggleGroupItem'

export { ToggleGroup, ToggleGroupItem }
