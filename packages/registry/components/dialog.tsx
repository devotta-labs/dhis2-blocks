'use client'

import { Dialog as DialogPrimitive } from '@base-ui/react/dialog'
import { IconCross16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { Button } from './button'
import { cn } from './cn'
import { dhis2PortalRoot } from './portal-root'

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
    return <DialogPrimitive.Root data-slot="dialog" {...props} />
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const DialogTrigger = React.forwardRef<
    HTMLButtonElement,
    DialogPrimitive.Trigger.Props
>((props, ref) => (
    <DialogPrimitive.Trigger ref={ref} data-slot="dialog-trigger" {...props} />
))
DialogTrigger.displayName = 'DialogTrigger'

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
    return (
        <DialogPrimitive.Portal
            data-slot="dialog-portal"
            container={dhis2PortalRoot()}
            {...props}
        />
    )
}

const DialogClose = React.forwardRef<
    HTMLButtonElement,
    DialogPrimitive.Close.Props
>((props, ref) => (
    <DialogPrimitive.Close ref={ref} data-slot="dialog-close" {...props} />
))
DialogClose.displayName = 'DialogClose'

function DialogOverlay({
    className,
    ...props
}: DialogPrimitive.Backdrop.Props) {
    return (
        <DialogPrimitive.Backdrop
            data-slot="dialog-overlay"
            className={cn('fixed inset-0 bg-dhis2-overlay', className)}
            {...props}
        />
    )
}

function DialogContent({
    className,
    children,
    showCloseButton = true,
    closeLabel = 'Close',
    ...props
}: DialogPrimitive.Popup.Props & {
    showCloseButton?: boolean
    /** Accessible name of the corner close button. */
    closeLabel?: string
}) {
    return (
        <DialogPortal>
            <DialogOverlay />
            <DialogPrimitive.Popup
                data-slot="dialog-content"
                className={cn(
                    'fixed top-1/2 left-1/2 flex w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col rounded-dhis2-sm bg-white p-6 text-dhis2-grey-900 shadow-dhis2-card outline-none sm:max-w-sm',
                    className
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <DialogPrimitive.Close
                        data-slot="dialog-close"
                        aria-label={closeLabel}
                        className="absolute end-0 top-0 flex cursor-pointer rounded-dhis2-sm border-0 bg-transparent px-1 pt-1 pb-0 text-dhis2-grey-700 outline-none hover:bg-dhis2-grey-200 hover:text-dhis2-grey-900 focus-visible:bg-dhis2-grey-200 focus-visible:outline-3 focus-visible:outline-solid focus-visible:outline-dhis2-ring active:bg-dhis2-grey-300 [&_svg]:fill-current"
                    >
                        <IconCross16 />
                    </DialogPrimitive.Close>
                )}
            </DialogPrimitive.Popup>
        </DialogPortal>
    )
}

function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="dialog-header"
            className={cn('mb-3 flex flex-col gap-1', className)}
            {...props}
        />
    )
}

function DialogFooter({
    className,
    showCloseButton = false,
    closeLabel = 'Close',
    children,
    ...props
}: React.ComponentProps<'div'> & {
    showCloseButton?: boolean
    closeLabel?: string
}) {
    return (
        <div
            data-slot="dialog-footer"
            className={cn(
                'mt-4 flex flex-wrap items-center justify-end gap-2',
                className
            )}
            {...props}
        >
            {children}
            {showCloseButton && (
                <DialogPrimitive.Close render={<Button variant="outline" />}>
                    {closeLabel}
                </DialogPrimitive.Close>
            )}
        </div>
    )
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
    return (
        <DialogPrimitive.Title
            data-slot="dialog-title"
            className={cn(
                'm-0 text-xl leading-6 font-medium text-dhis2-grey-900',
                className
            )}
            {...props}
        />
    )
}

function DialogDescription({
    className,
    ...props
}: DialogPrimitive.Description.Props) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            className={cn(
                'm-0 text-dhis2-grey-900 *:[a]:underline *:[a]:underline-offset-3',
                className
            )}
            {...props}
        />
    )
}

export {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
    DialogTrigger,
}
