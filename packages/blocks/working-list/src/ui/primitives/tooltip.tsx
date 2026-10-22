'use client'

import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import * as React from 'react'
import { cn } from './cn'

function TooltipProvider({
    delay = 0,
    ...props
}: TooltipPrimitive.Provider.Props) {
    return (
        <TooltipPrimitive.Provider
            data-slot="tooltip-provider"
            delay={delay}
            {...props}
        />
    )
}

function Tooltip({ ...props }: TooltipPrimitive.Root.Props) {
    return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger({ ...props }: TooltipPrimitive.Trigger.Props) {
    return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/** shadcn TooltipContent restyled to match @dhis2/ui Tooltip. */
function TooltipContent({
    className,
    side = 'top',
    sideOffset = 4,
    align = 'center',
    alignOffset = 0,
    children,
    ...props
}: TooltipPrimitive.Popup.Props &
    Pick<
        TooltipPrimitive.Positioner.Props,
        'align' | 'alignOffset' | 'side' | 'sideOffset'
    >) {
    return (
        <TooltipPrimitive.Portal>
            <TooltipPrimitive.Positioner
                align={align}
                alignOffset={alignOffset}
                side={side}
                sideOffset={sideOffset}
                className="isolate z-[2000]"
            >
                <TooltipPrimitive.Popup
                    data-slot="tooltip-content"
                    className={cn(
                        'z-[2000] w-fit max-w-[300px] rounded-sm bg-grey-900 px-1.5 py-1 text-[13px] leading-[17px] wrap-break-word text-white',
                        className
                    )}
                    {...props}
                >
                    {children}
                </TooltipPrimitive.Popup>
            </TooltipPrimitive.Positioner>
        </TooltipPrimitive.Portal>
    )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
