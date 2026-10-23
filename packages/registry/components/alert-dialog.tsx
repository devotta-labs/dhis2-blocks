'use client'

import { AlertDialog as AlertDialogPrimitive } from '@base-ui/react/alert-dialog'
import { cva } from 'class-variance-authority'
import * as React from 'react'
import { Button } from './button'
import { cn } from './cn'
import { dhis2PortalRoot } from './portal-root'

/*
 * shadcn Alert Dialog (Base UI) restyled to match a small @dhis2/ui Modal.
 * Unlike Dialog it has no corner close button and ignores backdrop presses,
 * so the person answers it with one of its actions (or Escape).
 * size `sm` = Modal small (400px), `default` = Modal default (600px).
 */

function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
    return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const AlertDialogTrigger = React.forwardRef<
    HTMLButtonElement,
    AlertDialogPrimitive.Trigger.Props
>((props, ref) => (
    <AlertDialogPrimitive.Trigger
        ref={ref}
        data-slot="alert-dialog-trigger"
        {...props}
    />
))
AlertDialogTrigger.displayName = 'AlertDialogTrigger'

function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) {
    return (
        <AlertDialogPrimitive.Portal
            data-slot="alert-dialog-portal"
            container={dhis2PortalRoot()}
            {...props}
        />
    )
}

function AlertDialogOverlay({
    className,
    ...props
}: AlertDialogPrimitive.Backdrop.Props) {
    return (
        <AlertDialogPrimitive.Backdrop
            data-slot="alert-dialog-overlay"
            className={cn('fixed inset-0 bg-dhis2-overlay', className)}
            {...props}
        />
    )
}

const alertDialogContentVariants = cva(
    'fixed left-1/2 flex max-h-[calc(100vh-128px)] max-w-[calc(100vw-128px)] -translate-x-1/2 flex-col rounded-dhis2-sm bg-white p-6 text-dhis2-grey-900 shadow-dhis2-card outline-none',
    {
        variants: {
            size: {
                sm: 'w-[400px]',
                default: 'w-[600px]',
            },
            position: {
                top: 'top-16',
                middle: 'top-1/2 -translate-y-1/2',
            },
        },
    }
)

function AlertDialogContent({
    className,
    size = 'sm',
    position = 'middle',
    ...props
}: AlertDialogPrimitive.Popup.Props & {
    size?: 'default' | 'sm'
    position?: 'top' | 'middle'
}) {
    return (
        <AlertDialogPortal>
            <AlertDialogOverlay />
            <AlertDialogPrimitive.Popup
                data-slot="alert-dialog-content"
                data-size={size}
                className={cn(
                    'group/alert-dialog-content',
                    alertDialogContentVariants({ size, position }),
                    className
                )}
                {...props}
            />
        </AlertDialogPortal>
    )
}

function AlertDialogHeader({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-dialog-header"
            className={cn('mb-3 flex flex-col gap-3', className)}
            {...props}
        />
    )
}

function AlertDialogFooter({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-dialog-footer"
            className={cn(
                'mt-4 flex flex-wrap items-center justify-end gap-2',
                className
            )}
            {...props}
        />
    )
}

function AlertDialogMedia({
    className,
    ...props
}: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="alert-dialog-media"
            className={cn(
                "inline-flex size-12 items-center justify-center rounded-dhis2-sm bg-dhis2-grey-200 [&_svg]:fill-current *:[svg:not([class*='size-'])]:size-6",
                className
            )}
            {...props}
        />
    )
}

function AlertDialogTitle({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Title>) {
    return (
        <AlertDialogPrimitive.Title
            data-slot="alert-dialog-title"
            className={cn(
                'm-0 text-xl leading-6 font-medium text-dhis2-grey-900',
                className
            )}
            {...props}
        />
    )
}

function AlertDialogDescription({
    className,
    ...props
}: React.ComponentProps<typeof AlertDialogPrimitive.Description>) {
    return (
        <AlertDialogPrimitive.Description
            data-slot="alert-dialog-description"
            className={cn(
                'm-0 text-dhis2-grey-900 *:[a]:underline *:[a]:underline-offset-3',
                className
            )}
            {...props}
        />
    )
}

const AlertDialogAction = React.forwardRef<
    HTMLButtonElement,
    React.ComponentProps<typeof Button>
>(({ className, ...props }, ref) => (
    <Button
        ref={ref}
        data-slot="alert-dialog-action"
        className={cn(className)}
        {...props}
    />
))
AlertDialogAction.displayName = 'AlertDialogAction'

const AlertDialogCancel = React.forwardRef<
    HTMLButtonElement,
    AlertDialogPrimitive.Close.Props &
        Pick<React.ComponentProps<typeof Button>, 'variant' | 'size'>
>(({ className, variant = 'outline', size = 'default', ...props }, ref) => (
    <AlertDialogPrimitive.Close
        ref={ref}
        data-slot="alert-dialog-cancel"
        className={cn(className)}
        render={<Button variant={variant} size={size} />}
        {...props}
    />
))
AlertDialogCancel.displayName = 'AlertDialogCancel'

export {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogOverlay,
    AlertDialogPortal,
    AlertDialogTitle,
    AlertDialogTrigger,
}
