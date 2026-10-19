import { IconErrorFilled24 } from '@dhis2/ui-icons'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/** shadcn Alert restyled to match @dhis2/ui NoticeBox. */
const alertVariants = cva(
    'group/alert relative grid w-full gap-0.5 rounded-dhis2-sm border px-4 py-3 text-left text-sm leading-[19px] text-dhis2-grey-900 has-data-[slot=alert-action]:relative has-data-[slot=alert-action]:pr-18 has-[>svg]:grid-cols-[auto_1fr] has-[>svg]:gap-x-2 *:[svg]:row-span-2 *:[svg]:fill-current *:[svg:not([class*=size-])]:size-6',
    {
        variants: {
            variant: {
                default:
                    'border-dhis2-blue-200 bg-dhis2-blue-050 *:[svg]:text-dhis2-blue-900',
                warning:
                    'border-dhis2-yellow-200 bg-dhis2-yellow-050 *:[svg]:text-dhis2-yellow-700',
                destructive:
                    'border-2 border-dhis2-red-500 bg-dhis2-red-050 *:[svg]:text-dhis2-red-700',
                success:
                    'border-dhis2-green-200 bg-dhis2-green-050 *:[svg]:text-dhis2-green-700',
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
                'flex flex-col items-start gap-2 pt-1.5 text-sm text-dhis2-grey-900 group-has-[>svg]/alert:col-start-2 [&_a]:underline [&_a]:underline-offset-3 [&_p]:m-0',
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
