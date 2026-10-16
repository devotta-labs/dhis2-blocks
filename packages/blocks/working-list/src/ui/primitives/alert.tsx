import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Alert restyled to match @dhis2/ui NoticeBox. */
const alertVariants = cva(
    'group/alert relative grid w-full gap-0.5 rounded-sm border px-4 py-3 text-left text-sm leading-[19px] text-grey-900 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:fill-current *:[svg:not([class*=size-])]:size-6',
    {
        variants: {
            variant: {
                default: 'border-blue-200 bg-blue-050 *:[svg]:text-blue-900',
                warning:
                    'border-yellow-200 bg-yellow-050 *:[svg]:text-yellow-700',
                destructive:
                    'border-2 border-red-500 bg-red-050 *:[svg]:text-red-700',
                success: 'border-green-200 bg-green-050 *:[svg]:text-green-700',
            },
        },
        defaultVariants: {
            variant: 'default',
        },
    }
)

function Alert({
    className,
    variant,
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
    return (
        <div
            data-slot="alert"
            role="alert"
            className={cn(alertVariants({ variant }), className)}
            {...props}
        />
    )
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-title"
            className={cn(
                'font-medium group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3',
                className
            )}
            {...props}
        />
    )
}

function AlertDescription({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-description"
            className={cn(
                'flex flex-col items-start gap-2 pt-1.5 text-sm text-grey-900 group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_p]:m-0',
                className
            )}
            {...props}
        />
    )
}

function AlertAction({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-action"
            className={cn('absolute top-2.5 right-3', className)}
            {...props}
        />
    )
}

export { Alert, AlertTitle, AlertDescription, AlertAction }
