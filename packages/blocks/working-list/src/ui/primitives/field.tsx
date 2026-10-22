'use client'

import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { useMemo } from 'react'
import { cn } from './cn'
import { Label } from './label'

/** shadcn Field, restyled to match @dhis2/ui Field spacing and colors. */
function FieldGroup({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="field-group"
            className={cn(
                'group/field-group @container/field-group flex w-full flex-col gap-4 data-[slot=checkbox-group]:gap-2 *:data-[slot=field-group]:gap-3',
                className
            )}
            {...props}
        />
    )
}

const fieldVariants = cva(
    'group/field flex w-full gap-2 data-[invalid=true]:text-red-700',
    {
        variants: {
            orientation: {
                vertical: 'flex-col *:w-full [&>.sr-only]:w-auto',
                horizontal:
                    'flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
            },
        },
        defaultVariants: {
            orientation: 'vertical',
        },
    }
)

function Field({
    className,
    orientation = 'vertical',
    ...props
}: React.ComponentProps<'div'> & VariantProps<typeof fieldVariants>) {
    return (
        <div
            role="group"
            data-slot="field"
            data-orientation={orientation}
            className={cn(fieldVariants({ orientation }), className)}
            {...props}
        />
    )
}

function FieldContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="field-content"
            className={cn(
                'group/field-content flex flex-1 flex-col gap-1 leading-snug',
                className
            )}
            {...props}
        />
    )
}

function FieldLabel({
    className,
    ...props
}: React.ComponentProps<typeof Label>) {
    return (
        <Label
            data-slot="field-label"
            className={cn(
                'group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:text-grey-600',
                className
            )}
            {...props}
        />
    )
}

function FieldDescription({ className, ...props }: React.ComponentProps<'p'>) {
    return (
        <p
            data-slot="field-description"
            className={cn(
                'm-0 text-left text-sm leading-normal font-normal text-grey-700',
                className
            )}
            {...props}
        />
    )
}

function FieldError({
    className,
    children,
    errors,
    ...props
}: React.ComponentProps<'div'> & {
    errors?: Array<{ message?: string } | undefined>
}) {
    const content = useMemo(() => {
        if (children) {
            return children
        }

        if (!errors?.length) {
            return null
        }

        const uniqueErrors = [
            ...new Map(errors.map((error) => [error?.message, error])).values(),
        ]

        if (uniqueErrors?.length == 1) {
            return uniqueErrors[0]?.message
        }

        return (
            <ul className="ml-4 flex list-disc flex-col gap-1">
                {uniqueErrors.map(
                    (error, index) =>
                        error?.message && <li key={index}>{error.message}</li>
                )}
            </ul>
        )
    }, [children, errors])

    if (!content) {
        return null
    }

    return (
        <div
            role="alert"
            data-slot="field-error"
            className={cn('text-sm font-normal text-red-700', className)}
            {...props}
        >
            {content}
        </div>
    )
}

export {
    Field,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldContent,
}
