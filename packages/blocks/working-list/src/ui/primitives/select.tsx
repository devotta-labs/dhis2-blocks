'use client'

import { Select as SelectPrimitive } from '@base-ui/react/select'
import { IconChevronDown16, IconChevronUp16 } from '@dhis2/ui-icons'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from './cn'

/*
 * shadcn Select (Base UI) restyled to match @dhis2/ui SingleSelect.
 * size `sm` = DHIS2 `dense` (32px), `default` = 40px. Menus open below the
 * trigger, as DHIS2's do, instead of over it.
 */

const Select = SelectPrimitive.Root

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
    return (
        <SelectPrimitive.Group
            data-slot="select-group"
            className={cn('scroll-my-1 py-1', className)}
            {...props}
        />
    )
}

function SelectValue({ className, ...props }: SelectPrimitive.Value.Props) {
    return (
        <SelectPrimitive.Value
            data-slot="select-value"
            className={cn('flex flex-1 text-left', className)}
            {...props}
        />
    )
}

/** The @dhis2/ui select input box, shared with the Combobox trigger. */
const selectTriggerVariants = cva(
    "flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 rounded-sm border border-input bg-white text-left text-sm leading-4 whitespace-nowrap text-grey-900 shadow-[inset_0_0_1px_0_rgb(48_54_60/0.1)] outline-none focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_2px_var(--color-ring)] data-popup-open:border-ring data-popup-open:shadow-[inset_0_0_0_2px_var(--color-ring)] disabled:cursor-not-allowed disabled:bg-grey-100 disabled:text-grey-600 aria-invalid:border-red-500 data-placeholder:text-grey-600 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
    {
        variants: {
            size: {
                default: 'min-h-10 py-1.5 ps-3 pe-1.5',
                sm: 'min-h-8 py-0.5 ps-2 pe-1',
            },
        },
        defaultVariants: {
            size: 'default',
        },
    }
)

// React 18 drops `ref` from function component props; shadcn targets React 19.
const SelectTrigger = React.forwardRef<
    HTMLButtonElement,
    SelectPrimitive.Trigger.Props & VariantProps<typeof selectTriggerVariants>
>(({ className, size = 'default', children, ...props }, ref) => (
    <SelectPrimitive.Trigger
        ref={ref}
        data-slot="select-trigger"
        data-size={size}
        className={cn(
            selectTriggerVariants({ size }),
            '*:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5',
            className
        )}
        {...props}
    >
        {children}
        <SelectPrimitive.Icon
            render={<span className="ms-0.5 flex text-grey-900" />}
        >
            <IconChevronDown16 />
        </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = 'SelectTrigger'

function SelectContent({
    className,
    children,
    side = 'bottom',
    sideOffset = 0,
    align = 'start',
    alignOffset = 0,
    alignItemWithTrigger = false,
    ...props
}: SelectPrimitive.Popup.Props &
    Pick<
        SelectPrimitive.Positioner.Props,
        'align' | 'alignOffset' | 'side' | 'sideOffset' | 'alignItemWithTrigger'
    >) {
    return (
        <SelectPrimitive.Portal>
            <SelectPrimitive.Positioner
                side={side}
                sideOffset={sideOffset}
                align={align}
                alignOffset={alignOffset}
                alignItemWithTrigger={alignItemWithTrigger}
                className="isolate z-[2000]"
            >
                <SelectPrimitive.Popup
                    data-slot="select-content"
                    data-align-trigger={alignItemWithTrigger}
                    className={cn(
                        'relative isolate z-[2000] max-h-[min(280px,var(--available-height))] w-(--anchor-width) min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-sm border border-grey-200 bg-popover text-popover-foreground shadow-popover',
                        className
                    )}
                    {...props}
                >
                    <SelectScrollUpButton />
                    <SelectPrimitive.List>{children}</SelectPrimitive.List>
                    <SelectScrollDownButton />
                </SelectPrimitive.Popup>
            </SelectPrimitive.Positioner>
        </SelectPrimitive.Portal>
    )
}

function SelectLabel({
    className,
    ...props
}: SelectPrimitive.GroupLabel.Props) {
    return (
        <SelectPrimitive.GroupLabel
            data-slot="select-label"
            className={cn(
                'px-3 pt-2 pb-1 text-[13px] leading-4 font-medium text-grey-700',
                className
            )}
            {...props}
        />
    )
}

/** The checkmark @dhis2/ui SingleSelectOption shows beside the selected option. */
function SelectCheckmark() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
            <path d="M3.63209 7.83214C3.27209 7.47214 2.72009 7.47214 2.36009 7.83214C2.00009 8.19214 2.00009 8.74414 2.36009 9.10414L5.62409 12.3681C5.98409 12.7281 6.53609 12.7281 6.89609 12.3681L14.6481 4.64014C15.0081 4.28014 15.0081 3.72814 14.6481 3.36814C14.2881 3.00814 13.7361 3.00814 13.3521 3.36814L6.27209 10.4721L3.63209 7.83214Z" />
        </svg>
    )
}

/** The circled cross @dhis2/ui selects use for their clear button. */
function SelectClearIcon() {
    return (
        <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4">
            <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16Zm3.536-5.879a1 1 0 1 1-1.415 1.414l-2.12-2.12-2.122 2.121a1 1 0 1 1-1.415-1.414L6.586 8 4.464 5.878A1 1 0 1 1 5.88 4.464L8 6.586l2.121-2.121a1 1 0 1 1 1.415 1.414L9.415 8l2.12 2.121Z" />
        </svg>
    )
}

const SelectItem = React.forwardRef<HTMLDivElement, SelectPrimitive.Item.Props>(
    ({ className, children, ...props }, ref) => (
        <SelectPrimitive.Item
            ref={ref}
            data-slot="select-item"
            className={cn(
                'relative flex w-full cursor-pointer items-center py-2 ps-1.5 pe-3 text-sm leading-normal text-grey-900 outline-none select-none data-highlighted:bg-grey-200 data-selected:bg-teal-050 data-disabled:cursor-not-allowed data-disabled:text-grey-500 data-disabled:data-highlighted:bg-transparent [&_svg]:pointer-events-none [&_svg]:shrink-0',
                className
            )}
            {...props}
        >
            <span className="me-1.5 flex size-4 shrink-0 text-teal-700 [&_svg]:fill-current">
                <SelectPrimitive.ItemIndicator>
                    <SelectCheckmark />
                </SelectPrimitive.ItemIndicator>
            </span>
            <SelectPrimitive.ItemText className="flex flex-1 gap-2">
                {children}
            </SelectPrimitive.ItemText>
        </SelectPrimitive.Item>
    )
)
SelectItem.displayName = 'SelectItem'

function SelectSeparator({
    className,
    ...props
}: SelectPrimitive.Separator.Props) {
    return (
        <SelectPrimitive.Separator
            data-slot="select-separator"
            className={cn('pointer-events-none my-1 h-px bg-border', className)}
            {...props}
        />
    )
}

function SelectScrollUpButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
    return (
        <SelectPrimitive.ScrollUpArrow
            data-slot="select-scroll-up-button"
            className={cn(
                'top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg]:fill-current',
                className
            )}
            {...props}
        >
            <IconChevronUp16 />
        </SelectPrimitive.ScrollUpArrow>
    )
}

function SelectScrollDownButton({
    className,
    ...props
}: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
    return (
        <SelectPrimitive.ScrollDownArrow
            data-slot="select-scroll-down-button"
            className={cn(
                'bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg]:fill-current',
                className
            )}
            {...props}
        >
            <IconChevronDown16 />
        </SelectPrimitive.ScrollDownArrow>
    )
}

export {
    Select,
    SelectCheckmark,
    SelectClearIcon,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectScrollDownButton,
    SelectScrollUpButton,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
    selectTriggerVariants,
}
