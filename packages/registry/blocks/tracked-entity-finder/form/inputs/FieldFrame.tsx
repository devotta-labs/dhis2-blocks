import React, { type ReactNode } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Field,
    FieldDescription,
    FieldError,
    FieldLabel,
} from '@/components/dhis2/ui/field'

/** Label, control, description and issue for a single-control field. */
export const FieldFrame = ({
    controlId,
    label,
    description,
    error,
    className,
    children,
}: {
    controlId: string
    label: string
    description?: string
    error?: string
    className?: string
    children: ReactNode
}) => (
    <Field
        data-invalid={error ? true : undefined}
        className={cn('gap-1', className)}
    >
        <FieldLabel htmlFor={controlId}>{label}</FieldLabel>
        {children}
        {description && <FieldDescription>{description}</FieldDescription>}
        {error && <FieldError>{error}</FieldError>}
    </Field>
)
