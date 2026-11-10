import { IconErrorFilled24 } from '@dhis2/ui-icons'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Alert restyled to match @dhis2/ui NoticeBox. */
const alertVariants = cva(
    'group/alert relative grid w-full gap-0.5 rounded-dhis2-sm border px-4 py-3 text-left text-sm leading-[19px] text-dhis2-foreground has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:fill-current *:[svg:not([class*=size-])]:size-6',
    {
        variants: {
            variant: {
                default:
                    'border-dhis2-info-border bg-dhis2-info-subtle *:[svg]:text-dhis2-info',
                warning:
                    'border-dhis2-warning-border bg-dhis2-warning-subtle *:[svg]:text-dhis2-warning',
                destructive:
                    'border-2 border-dhis2-destructive-border bg-dhis2-destructive-subtle *:[svg]:text-dhis2-destructive',
                success:
                    'border-dhis2-success-border bg-dhis2-success-subtle *:[svg]:text-dhis2-success',
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
            // Only an error interrupts; other alerts wait their turn.
            role={variant === 'destructive' ? 'alert' : 'status'}
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
                'flex flex-col items-start gap-2 pt-1.5 text-sm text-dhis2-foreground group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_p]:m-0',
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

/** A destructive Alert with the @dhis2/ui error icon: the NoticeBox `error` stand-in. */
function ErrorAlert({
    title,
    children,
    ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { title: React.ReactNode }) {
    return (
        <Alert variant="destructive" {...props}>
            <IconErrorFilled24 />
            <AlertTitle>{title}</AlertTitle>
            {children !== undefined && (
                <AlertDescription>{children}</AlertDescription>
            )}
        </Alert>
    )
}

export { Alert, AlertTitle, AlertDescription, AlertAction, ErrorAlert }
