import * as React from 'react'
import { cn } from './cn'

/** shadcn Card: a white surface with the DHIS2 card shadow. */
function Card({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card"
            className={cn(
                'flex flex-col gap-4 rounded-dhis2-md bg-dhis2-card py-4 text-dhis2-card-foreground shadow-dhis2-card',
                className
            )}
            {...props}
        />
    )
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-header"
            className={cn('flex flex-col gap-1 px-4', className)}
            {...props}
        />
    )
}

function CardTitle({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-title"
            className={cn('text-base leading-snug font-medium', className)}
            {...props}
        />
    )
}

function CardDescription({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-description"
            className={cn('text-sm text-dhis2-grey-700', className)}
            {...props}
        />
    )
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-content"
            className={cn('px-4', className)}
            {...props}
        />
    )
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="card-footer"
            className={cn('flex items-center px-4', className)}
            {...props}
        />
    )
}

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle }
