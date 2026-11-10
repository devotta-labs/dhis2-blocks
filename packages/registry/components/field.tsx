'use client'

import { Field as FieldPrimitive } from '@base-ui/react/field'
import { Fieldset as FieldsetPrimitive } from '@base-ui/react/fieldset'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { useMemo } from 'react'
import { cn } from './cn'
import { Label } from './label'
import { Separator } from './separator'

/** shadcn Field, restyled to match @dhis2/ui Field spacing and colors. */

/** Groups related fields, or a group's options, under a legend; Base UI names the fieldset by its legend. */
function FieldSet({ className, ...props }: FieldsetPrimitive.Root.Props) {
    return (
        <FieldsetPrimitive.Root
            data-slot="field-set"
            className={cn(
                // Rendered as a radio group (`render={<RadioGroup />}`), the options' spacing holds: the role marks it, as its
                // slot and classes are the fieldset's.
                'm-0 flex min-w-0 flex-col gap-4 border-0 p-0 has-[>[data-slot=checkbox-group]]:gap-2 has-[>[data-slot=radio-group]]:gap-2 [&[role=radiogroup]]:gap-2',
                className
            )}
            {...props}
        />
    )
}

const fieldLegendVariants = cva(
    'text-dhis2-foreground data-disabled:text-dhis2-disabled-foreground',
    {
        variants: {
            variant: {
                legend: 'mb-1 text-base leading-snug font-medium',
                // As a field's label: for a group of options, or a fieldset inside another.
                label: 'text-sm leading-snug font-medium',
            },
        },
        defaultVariants: { variant: 'legend' },
    }
)

function FieldLegend({
    className,
    variant = 'legend',
    ...props
}: FieldsetPrimitive.Legend.Props & VariantProps<typeof fieldLegendVariants>) {
    return (
        <FieldsetPrimitive.Legend
            data-slot="field-legend"
            data-variant={variant}
            className={cn(fieldLegendVariants({ variant }), className)}
            {...props}
        />
    )
}

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
    'group/field flex w-full gap-2 data-invalid:text-dhis2-destructive',
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

/** Links its label, description and error to the control inside it, and marks the control invalid with `invalid`. */
function Field({
    className,
    orientation = 'vertical',
    ...props
}: FieldPrimitive.Root.Props & VariantProps<typeof fieldVariants>) {
    return (
        <FieldPrimitive.Root
            data-slot="field"
            data-orientation={orientation}
            className={cn(fieldVariants({ orientation }), className)}
            {...props}
        />
    )
}

/**
 * One option of a radio or checkbox group: its control, then its label. Inside the group's Field it shares the field's
 * invalid and disabled state, which a Field of its own would not; its label and description are the option's.
 */
function FieldItem({ className, ...props }: FieldPrimitive.Item.Props) {
    return (
        <FieldPrimitive.Item
            data-slot="field-item"
            className={cn(
                'flex items-center gap-2 has-[>[data-slot=field-content]]:items-start has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px',
                className
            )}
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

function FieldLabel({ className, ...props }: FieldPrimitive.Label.Props) {
    return (
        <FieldPrimitive.Label
            data-slot="field-label"
            render={<Label />}
            className={cn(
                // Medium, so a field's label leads; an option's label, in a FieldItem, is regular.
                'group/field-label peer/field-label flex w-fit gap-2 leading-snug font-medium group-data-disabled/field:text-dhis2-disabled-foreground in-data-[slot=field-item]:font-normal',
                className
            )}
            {...props}
        />
    )
}

/** A title with a label's look, for a part that is not a control's label, such as a choice inside its own label. */
function FieldTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="field-label"
            className={cn(
                'flex w-fit items-center gap-2 text-sm leading-snug font-medium text-dhis2-foreground group-data-disabled/field:text-dhis2-disabled-foreground',
                className
            )}
            {...props}
        />
    )
}

function FieldDescription({
    className,
    ...props
}: FieldPrimitive.Description.Props) {
    return (
        <FieldPrimitive.Description
            data-slot="field-description"
            className={cn(
                'm-0 text-left text-sm leading-normal font-normal text-dhis2-muted-foreground',
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
}: FieldPrimitive.Error.Props & {
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
        // Shown whenever it has content, not only when the browser finds the control invalid.
        <FieldPrimitive.Error
            match
            role="alert"
            data-slot="field-error"
            className={cn(
                'text-sm font-normal text-dhis2-destructive',
                className
            )}
            {...props}
        >
            {content}
        </FieldPrimitive.Error>
    )
}

/** A line between fields in a group, with optional text on it. */
function FieldSeparator({
    children,
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="field-separator"
            data-content={children !== undefined}
            className={cn('relative -my-2 h-5 text-sm', className)}
            {...props}
        >
            <Separator className="absolute inset-0 top-1/2" />
            {children === undefined ? null : (
                <span
                    data-slot="field-separator-content"
                    className="relative mx-auto block w-fit bg-dhis2-background px-2 text-dhis2-muted-foreground"
                >
                    {children}
                </span>
            )}
        </div>
    )
}

/** For a control that isn't a Base UI part: its render props carry the field's ids and validity. */
const FieldControl = FieldPrimitive.Control

export {
    Field,
    FieldControl,
    FieldLabel,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldContent,
    FieldItem,
    FieldLegend,
    FieldSeparator,
    FieldSet,
    FieldTitle,
}
