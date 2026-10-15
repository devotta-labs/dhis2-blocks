import { Button as ButtonPrimitive } from '@base-ui/react/button'
import React from 'react'
import { cn } from './cn'

export interface ButtonProps extends ButtonPrimitive.Props {
    variant?: 'default' | 'primary' | 'secondary'
    size?: 'default' | 'small'
}

/**
 * SPIKE: a shadcn-shaped Button on Base UI, styled to match `@dhis2/ui`
 * Button. Variants are inline conditionals because the repository bans
 * extracted `cva` constants, and colors are literal values because the
 * stylesheet policy leaves no place to declare theme tokens.
 */
export const Button = ({
    className,
    variant = 'default',
    size = 'default',
    ...props
}: ButtonProps) => (
    <ButtonPrimitive
        data-slot="button"
        className={cn(
            'relative inline-flex cursor-pointer select-none items-center justify-center gap-1.5 rounded border border-[#a0adba] bg-[#f9fafb] px-3 text-sm font-normal leading-4 tracking-[0.5px] text-[#212934] no-underline hover:bg-[#f3f5f7] focus-visible:underline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-[#147cd7] active:bg-[#f3f5f7] active:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)] data-disabled:cursor-not-allowed data-disabled:border-[#d5dde5] data-disabled:bg-[#f9fafb] data-disabled:text-[#6c7787] data-disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current',
            size === 'default' && 'h-9',
            size === 'small' && 'h-7 gap-0.5 px-1.5',
            variant === 'primary' &&
                'border-[#0d47a1] bg-[linear-gradient(180deg,#1565c0_0%,#0650a3_100%)] font-medium text-white hover:bg-[linear-gradient(180deg,#054fa3_0%,#034793_100%)] focus-visible:-outline-offset-5 active:shadow-[inset_0_0_0_1px_rgba(0,0,0,0.18)] data-disabled:border-[#93a6bd] data-disabled:bg-none data-disabled:bg-[#b3c6de] data-disabled:text-white',
            variant === 'secondary' &&
                'border-[rgba(74,87,104,0.25)] bg-transparent hover:border-[rgba(74,87,104,0.5)] hover:bg-[rgba(160,173,186,0.05)] active:bg-[rgba(160,173,186,0.2)] active:shadow-none data-disabled:border-[rgba(74,87,104,0.25)] data-disabled:bg-transparent',
            className
        )}
        {...props}
    />
)
