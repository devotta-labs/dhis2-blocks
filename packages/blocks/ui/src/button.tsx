import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/**
 * shadcn Button (Base UI) restyled to match @dhis2/ui Button.
 * default = DHIS2 primary, outline = DHIS2 basic, secondary = DHIS2 secondary.
 * Sizes default/sm/lg match DHIS2 buttons; field-dense matches the sm Select.
 */
const buttonVariants = cva(
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-dhis2-md border text-sm leading-4 font-normal tracking-[0.5px] whitespace-nowrap no-underline outline-none select-none focus-visible:underline focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring disabled:cursor-not-allowed disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    'border-dhis2-blue-800 bg-[#2b61b3] bg-linear-to-b from-dhis2-blue-700 to-[#0650a3] font-medium text-dhis2-primary-foreground hover:from-[#054fa3] hover:to-[#034793] focus-visible:-outline-offset-5 active:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)] disabled:border-[#93a6bd] disabled:bg-none disabled:bg-[#b3c6de]',
                outline:
                    'border-dhis2-input bg-dhis2-grey-100 text-dhis2-grey-900 hover:bg-dhis2-grey-200 active:bg-dhis2-grey-200 active:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.1)] disabled:border-dhis2-grey-400 disabled:bg-dhis2-grey-100 disabled:text-dhis2-grey-600',
                secondary:
                    'border-dhis2-grey-700/25 bg-transparent text-dhis2-grey-900 hover:border-dhis2-grey-700/50 hover:bg-dhis2-grey-500/5 active:bg-dhis2-grey-500/20 disabled:border-dhis2-grey-700/25 disabled:bg-transparent disabled:text-dhis2-grey-600',
                destructive:
                    'border-[#a10b0b] bg-[#b9242b] bg-linear-to-b from-dhis2-red-500 to-dhis2-red-700 font-medium text-white hover:from-[#b81c1c] hover:to-[#b80c0b] active:shadow-[inset_0_0_0_1px_rgb(0_0_0/0.18)] disabled:border-[#c59898] disabled:bg-none disabled:bg-[#d6a8a8]',
                ghost: 'border-transparent bg-transparent text-dhis2-grey-900 hover:bg-dhis2-grey-200 disabled:text-dhis2-grey-600',
                link: 'border-transparent bg-transparent text-dhis2-primary underline-offset-4 hover:underline disabled:text-dhis2-grey-600',
            },
            size: {
                default: 'h-9 px-3',
                sm: 'h-7 gap-0.5 px-1.5',
                /** Matches a dense field, for buttons that sit beside one. */
                'field-dense': 'h-(--dhis2-field-height-dense) gap-0.5 px-1.5',
                lg: 'h-[43px] px-6 text-base tracking-[0.57px]',
                icon: 'size-9',
                'icon-sm': 'size-7',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    }
)

// React 18 drops `ref` from function component props; shadcn targets React 19.
const Button = React.forwardRef<
    HTMLButtonElement,
    ButtonPrimitive.Props & VariantProps<typeof buttonVariants>
>(({ className, variant = 'default', size = 'default', ...props }, ref) => (
    <ButtonPrimitive
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size, className }))}
        {...props}
    />
))
Button.displayName = 'Button'

export { Button, buttonVariants }
