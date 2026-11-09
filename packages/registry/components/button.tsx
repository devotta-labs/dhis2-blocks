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
    "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-dhis2-md border text-sm leading-4 font-normal tracking-[0.5px] whitespace-nowrap no-underline outline-none select-none focus-visible:underline focus-visible:outline-3 focus-visible:outline-solid focus-visible:-outline-offset-3 focus-visible:outline-dhis2-ring data-disabled:cursor-not-allowed data-disabled:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            variant: {
                default:
                    'border-dhis2-primary-strong bg-dhis2-primary font-medium text-dhis2-primary-foreground hover:bg-dhis2-primary-strong focus-visible:-outline-offset-5 focus-visible:outline-dhis2-primary-foreground active:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dhis2-foreground)_20%,transparent)] data-disabled:border-dhis2-border-strong data-disabled:bg-dhis2-accent-strong data-disabled:text-dhis2-disabled-foreground',
                outline:
                    'border-dhis2-input bg-dhis2-muted text-dhis2-foreground hover:bg-dhis2-accent active:bg-dhis2-accent active:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dhis2-foreground)_10%,transparent)] data-disabled:border-dhis2-border-strong data-disabled:bg-dhis2-muted data-disabled:text-dhis2-disabled-foreground',
                secondary:
                    'border-dhis2-border-strong bg-transparent text-dhis2-foreground hover:border-dhis2-input hover:bg-dhis2-muted active:bg-dhis2-accent data-disabled:border-dhis2-border-strong data-disabled:bg-transparent data-disabled:text-dhis2-disabled-foreground',
                destructive:
                    'border-dhis2-destructive bg-dhis2-destructive font-medium text-dhis2-destructive-foreground hover:bg-[color-mix(in_srgb,var(--dhis2-destructive),var(--dhis2-foreground)_25%)] focus-visible:-outline-offset-5 focus-visible:outline-dhis2-destructive-foreground active:shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--dhis2-foreground)_20%,transparent)] data-disabled:border-dhis2-border-strong data-disabled:bg-dhis2-accent-strong data-disabled:text-dhis2-disabled-foreground',
                ghost: 'border-transparent bg-transparent text-dhis2-foreground hover:bg-dhis2-accent data-disabled:text-dhis2-disabled-foreground',
                link: 'border-transparent bg-transparent text-dhis2-primary underline-offset-4 hover:underline data-disabled:text-dhis2-disabled-foreground',
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
