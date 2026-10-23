import { mergeProps } from '@base-ui/react/merge-props'
import { useRender } from '@base-ui/react/use-render'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from './cn'

/**
 * shadcn Badge (Base UI) as a small DHIS2 pill. Pass `style` to colour it from
 * metadata, such as a legend colour.
 */
const badgeVariants = cva(
    'inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2 text-xs leading-4 font-medium whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3',
    {
        variants: {
            variant: {
                default: 'bg-dhis2-primary text-dhis2-primary-foreground',
                secondary: 'bg-dhis2-secondary text-dhis2-secondary-foreground',
                outline: 'border-dhis2-border text-dhis2-foreground',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

function Badge({
    className,
    variant = 'default',
    render,
    ...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
    return useRender({
        defaultTagName: 'span',
        props: mergeProps<'span'>(
            { className: cn(badgeVariants({ variant }), className) },
            props
        ),
        render,
        state: { slot: 'badge', variant },
    })
}

export { Badge, badgeVariants }
