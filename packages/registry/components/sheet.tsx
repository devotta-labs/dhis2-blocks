'use client'

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog'
import { IconCross16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { cn } from './cn'
import { dhis2PortalRoot } from './portal-root'

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
    return <SheetPrimitive.Root data-slot="sheet" {...props} />
}

const SheetTrigger = React.forwardRef<
    HTMLButtonElement,
    SheetPrimitive.Trigger.Props
>((props, ref) => (
    <SheetPrimitive.Trigger ref={ref} data-slot="sheet-trigger" {...props} />
))
SheetTrigger.displayName = 'SheetTrigger'

const SheetClose = React.forwardRef<
    HTMLButtonElement,
    SheetPrimitive.Close.Props
>((props, ref) => (
    <SheetPrimitive.Close ref={ref} data-slot="sheet-close" {...props} />
))
SheetClose.displayName = 'SheetClose'

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
    return (
        <SheetPrimitive.Portal
            data-slot="sheet-portal"
            container={dhis2PortalRoot()}
            {...props}
        />
    )
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
    return (
        <SheetPrimitive.Backdrop
            data-slot="sheet-overlay"
            className={cn(
                'fixed inset-0 bg-dhis2-overlay transition-opacity duration-150 motion-reduce:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0',
                className
            )}
            {...props}
        />
    )
}

/**
 * shadcn Sheet (Base UI): a dialog docked to one edge of the window, on the
 * Dialog's backdrop and in the same portal, so DHIS2 popups opened from inside
 * it paint above it. `side` follows the text direction: left is where a line
 * starts.
 */
function SheetContent({
    className,
    children,
    side = 'right',
    showCloseButton = true,
    closeLabel = 'Close',
    ...props
}: SheetPrimitive.Popup.Props & {
    side?: 'top' | 'right' | 'bottom' | 'left'
    showCloseButton?: boolean
    /** Accessible name of the corner close button. */
    closeLabel?: string
}) {
    return (
        <SheetPortal>
            <SheetOverlay />
            <SheetPrimitive.Popup
                data-slot="sheet-content"
                data-side={side}
                className={cn(
                    'fixed flex flex-col gap-4 border-0 border-solid border-dhis2-border bg-dhis2-background text-sm text-dhis2-foreground shadow-dhis2-popover outline-none transition duration-200 ease-in-out motion-reduce:transition-none data-ending-style:opacity-0 data-starting-style:opacity-0',
                    'data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-10 data-[side=bottom]:data-starting-style:translate-y-10',
                    'data-[side=left]:inset-y-0 data-[side=left]:start-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-e data-[side=left]:data-ending-style:-translate-x-10 data-[side=left]:data-starting-style:-translate-x-10 rtl:data-[side=left]:data-ending-style:translate-x-10 rtl:data-[side=left]:data-starting-style:translate-x-10 data-[side=left]:sm:max-w-sm',
                    'data-[side=right]:inset-y-0 data-[side=right]:end-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-s data-[side=right]:data-ending-style:translate-x-10 data-[side=right]:data-starting-style:translate-x-10 rtl:data-[side=right]:data-ending-style:-translate-x-10 rtl:data-[side=right]:data-starting-style:-translate-x-10 data-[side=right]:sm:max-w-sm',
                    'data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:-translate-y-10 data-[side=top]:data-starting-style:-translate-y-10',
                    className
                )}
                {...props}
            >
                {children}
                {showCloseButton && (
                    <SheetPrimitive.Close
                        data-slot="sheet-close"
                        aria-label={closeLabel}
                        className="absolute end-3 top-3 flex size-6 cursor-pointer items-center justify-center rounded-dhis2-sm border-0 bg-transparent p-0 text-dhis2-muted-foreground outline-none hover:bg-dhis2-accent hover:text-dhis2-foreground focus-visible:bg-dhis2-accent focus-visible:outline-3 focus-visible:outline-dhis2-ring focus-visible:outline-solid active:bg-dhis2-accent-strong [&_svg]:fill-current"
                    >
                        <IconCross16 />
                    </SheetPrimitive.Close>
                )}
            </SheetPrimitive.Popup>
        </SheetPortal>
    )
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-header"
            className={cn('flex flex-col gap-0.5 p-4', className)}
            {...props}
        />
    )
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="sheet-footer"
            className={cn('mt-auto flex flex-col gap-2 p-4', className)}
            {...props}
        />
    )
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
    return (
        <SheetPrimitive.Title
            data-slot="sheet-title"
            className={cn(
                'm-0 text-base font-medium text-dhis2-foreground',
                className
            )}
            {...props}
        />
    )
}

function SheetDescription({
    className,
    ...props
}: SheetPrimitive.Description.Props) {
    return (
        <SheetPrimitive.Description
            data-slot="sheet-description"
            className={cn('m-0 text-sm text-dhis2-muted-foreground', className)}
            {...props}
        />
    )
}

export {
    Sheet,
    SheetTrigger,
    SheetClose,
    SheetContent,
    SheetHeader,
    SheetFooter,
    SheetTitle,
    SheetDescription,
}
