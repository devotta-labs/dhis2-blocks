'use client'

import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import * as React from 'react'
import { cn } from './cn'
import { dhis2PortalRoot } from './portal-root'

function Popover({ ...props }: PopoverPrimitive.Root.Props) {
    return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const PopoverTrigger = React.forwardRef<
    HTMLButtonElement,
    PopoverPrimitive.Trigger.Props
>((props, ref) => (
    <PopoverPrimitive.Trigger
        ref={ref}
        data-slot="popover-trigger"
        {...props}
    />
))
PopoverTrigger.displayName = 'PopoverTrigger'

/**
 * shadcn PopoverContent restyled to match @dhis2/ui Popover (`arrow={false}`):
 * white, 4px radius, elevations.popover, flush against its anchor.
 */
function PopoverContent({
    className,
    anchor,
    align = 'center',
    alignOffset = 0,
    side = 'bottom',
    sideOffset = 0,
    ...props
}: PopoverPrimitive.Popup.Props &
    Pick<
        PopoverPrimitive.Positioner.Props,
        'anchor' | 'align' | 'alignOffset' | 'side' | 'sideOffset'
    >) {
    return (
        <PopoverPrimitive.Portal container={dhis2PortalRoot()}>
            <PopoverPrimitive.Positioner
                anchor={anchor}
                align={align}
                alignOffset={alignOffset}
                side={side}
                sideOffset={sideOffset}
                className="isolate"
            >
                <PopoverPrimitive.Popup
                    data-slot="popover-content"
                    className={cn(
                        'flex w-72 max-w-[360px] origin-(--transform-origin) flex-col gap-4 rounded-md bg-popover p-4 text-sm text-popover-foreground shadow-popover outline-hidden',
                        className
                    )}
                    {...props}
                />
            </PopoverPrimitive.Positioner>
        </PopoverPrimitive.Portal>
    )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="popover-header"
            className={cn('flex flex-col gap-1 text-sm', className)}
            {...props}
        />
    )
}

function PopoverTitle({ className, ...props }: PopoverPrimitive.Title.Props) {
    return (
        <PopoverPrimitive.Title
            data-slot="popover-title"
            className={cn('m-0 text-base leading-5 font-medium', className)}
            {...props}
        />
    )
}

function PopoverDescription({
    className,
    ...props
}: PopoverPrimitive.Description.Props) {
    return (
        <PopoverPrimitive.Description
            data-slot="popover-description"
            className={cn('text-grey-700', className)}
            {...props}
        />
    )
}

export {
    Popover,
    PopoverContent,
    PopoverDescription,
    PopoverHeader,
    PopoverTitle,
    PopoverTrigger,
}
