'use client'

import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { IconCheckmark16, IconChevronRight16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { cn } from './cn'

/*
 * shadcn Dropdown Menu (Base UI) restyled to match @dhis2/ui FlyoutMenu,
 * MenuItem, MenuSectionHeader and MenuDivider in their `dense` form, which
 * is what the working list uses everywhere.
 */

function DropdownMenu({ ...props }: MenuPrimitive.Root.Props) {
    return <MenuPrimitive.Root data-slot="dropdown-menu" {...props} />
}

function DropdownMenuPortal({ ...props }: MenuPrimitive.Portal.Props) {
    return <MenuPrimitive.Portal data-slot="dropdown-menu-portal" {...props} />
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const DropdownMenuTrigger = React.forwardRef<
    HTMLButtonElement,
    MenuPrimitive.Trigger.Props
>((props, ref) => (
    <MenuPrimitive.Trigger
        ref={ref}
        data-slot="dropdown-menu-trigger"
        {...props}
    />
))
DropdownMenuTrigger.displayName = 'DropdownMenuTrigger'

/** The 12px arrow @dhis2/ui DropdownButton draws after its label. */
function DropdownMenuTriggerArrow({
    className,
    ...props
}: React.ComponentProps<'svg'>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 12 12"
            aria-hidden="true"
            data-slot="dropdown-menu-trigger-arrow"
            className={cn(
                'size-3 ms-0.5 in-data-popup-open:rotate-180',
                className
            )}
            {...props}
        >
            <path d="m5.29289 8.7071c.39053.3905 1.02369.3905 1.41422 0l2.99999-2.99999c.3905-.39053.3905-1.02369 0-1.41422-.3905-.39052-1.0237-.39052-1.4142 0l-2.2929 2.2929-2.29289-2.2929c-.39053-.39052-1.02369-.39052-1.41422 0-.39052.39053-.39052 1.02369 0 1.41422z" />
        </svg>
    )
}

function DropdownMenuContent({
    anchor,
    align = 'start',
    alignOffset = 0,
    side = 'bottom',
    sideOffset = 0,
    className,
    ...props
}: MenuPrimitive.Popup.Props &
    Pick<
        MenuPrimitive.Positioner.Props,
        'anchor' | 'align' | 'alignOffset' | 'side' | 'sideOffset'
    >) {
    return (
        <MenuPrimitive.Portal>
            <MenuPrimitive.Positioner
                className="isolate z-[2000] outline-none"
                anchor={anchor}
                align={align}
                alignOffset={alignOffset}
                side={side}
                sideOffset={sideOffset}
            >
                <MenuPrimitive.Popup
                    data-slot="dropdown-menu-content"
                    className={cn(
                        'z-[2000] max-h-(--available-height) max-w-[380px] min-w-32 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-sm bg-popover py-1 text-popover-foreground shadow-popover outline-none',
                        className
                    )}
                    {...props}
                />
            </MenuPrimitive.Positioner>
        </MenuPrimitive.Portal>
    )
}

function DropdownMenuGroup({ ...props }: MenuPrimitive.Group.Props) {
    return <MenuPrimitive.Group data-slot="dropdown-menu-group" {...props} />
}

function DropdownMenuLabel({
    className,
    inset,
    ...props
}: MenuPrimitive.GroupLabel.Props & {
    inset?: boolean
}) {
    return (
        <MenuPrimitive.GroupLabel
            data-slot="dropdown-menu-label"
            data-inset={inset}
            className={cn(
                'px-3 pt-2 pb-1 text-[13px] leading-4 font-medium text-grey-700 data-inset:pl-9',
                className
            )}
            {...props}
        />
    )
}

const menuItemClasses =
    "relative flex min-h-8 cursor-pointer items-center gap-2 bg-popover px-3 py-2 text-sm leading-4 text-grey-900 outline-none select-none data-highlighted:bg-grey-200 active:bg-grey-300 focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring data-inset:pl-9 data-disabled:cursor-not-allowed data-disabled:bg-popover data-disabled:text-grey-500 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4"

const DropdownMenuItem = React.forwardRef<
    HTMLElement,
    MenuPrimitive.Item.Props & {
        inset?: boolean
        variant?: 'default' | 'destructive'
    }
>(({ className, inset, variant = 'default', ...props }, ref) => (
    <MenuPrimitive.Item
        ref={ref}
        data-slot="dropdown-menu-item"
        data-inset={inset}
        data-variant={variant}
        className={cn(
            'group/dropdown-menu-item',
            menuItemClasses,
            'data-[variant=destructive]:text-red-700 data-[variant=destructive]:data-highlighted:bg-red-050 data-[variant=destructive]:active:bg-red-100 data-[variant=destructive]:*:[svg]:text-red-600',
            className
        )}
        {...props}
    />
))
DropdownMenuItem.displayName = 'DropdownMenuItem'

function DropdownMenuSub({ ...props }: MenuPrimitive.SubmenuRoot.Props) {
    return (
        <MenuPrimitive.SubmenuRoot data-slot="dropdown-menu-sub" {...props} />
    )
}

const DropdownMenuSubTrigger = React.forwardRef<
    HTMLElement,
    MenuPrimitive.SubmenuTrigger.Props & {
        inset?: boolean
    }
>(({ className, inset, children, ...props }, ref) => (
    <MenuPrimitive.SubmenuTrigger
        ref={ref}
        data-slot="dropdown-menu-sub-trigger"
        data-inset={inset}
        className={cn(
            menuItemClasses,
            'pe-1 data-popup-open:bg-grey-300',
            className
        )}
        {...props}
    >
        {children}
        <span className="ms-auto flex ps-6 rtl:rotate-180">
            <IconChevronRight16 />
        </span>
    </MenuPrimitive.SubmenuTrigger>
))
DropdownMenuSubTrigger.displayName = 'DropdownMenuSubTrigger'

function DropdownMenuSubContent({
    align = 'start',
    alignOffset = -4,
    side = 'right',
    sideOffset = 0,
    className,
    ...props
}: React.ComponentProps<typeof DropdownMenuContent>) {
    return (
        <DropdownMenuContent
            data-slot="dropdown-menu-sub-content"
            className={cn('w-auto', className)}
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            {...props}
        />
    )
}

function DropdownMenuCheckboxItem({
    className,
    children,
    checked,
    inset,
    ...props
}: MenuPrimitive.CheckboxItem.Props & {
    inset?: boolean
}) {
    return (
        <MenuPrimitive.CheckboxItem
            data-slot="dropdown-menu-checkbox-item"
            data-inset={inset}
            className={cn(menuItemClasses, 'pr-9', className)}
            checked={checked}
            {...props}
        >
            <span
                className="pointer-events-none absolute right-3 flex items-center justify-center"
                data-slot="dropdown-menu-checkbox-item-indicator"
            >
                <MenuPrimitive.CheckboxItemIndicator>
                    <IconCheckmark16 />
                </MenuPrimitive.CheckboxItemIndicator>
            </span>
            {children}
        </MenuPrimitive.CheckboxItem>
    )
}

function DropdownMenuRadioGroup({ ...props }: MenuPrimitive.RadioGroup.Props) {
    return (
        <MenuPrimitive.RadioGroup
            data-slot="dropdown-menu-radio-group"
            {...props}
        />
    )
}

function DropdownMenuRadioItem({
    className,
    children,
    inset,
    ...props
}: MenuPrimitive.RadioItem.Props & {
    inset?: boolean
}) {
    return (
        <MenuPrimitive.RadioItem
            data-slot="dropdown-menu-radio-item"
            data-inset={inset}
            className={cn(menuItemClasses, 'pr-9', className)}
            {...props}
        >
            <span
                className="pointer-events-none absolute right-3 flex items-center justify-center"
                data-slot="dropdown-menu-radio-item-indicator"
            >
                <MenuPrimitive.RadioItemIndicator>
                    <IconCheckmark16 />
                </MenuPrimitive.RadioItemIndicator>
            </span>
            {children}
        </MenuPrimitive.RadioItem>
    )
}

function DropdownMenuSeparator({
    className,
    ...props
}: MenuPrimitive.Separator.Props) {
    return (
        <MenuPrimitive.Separator
            data-slot="dropdown-menu-separator"
            className={cn('my-1 h-px bg-border', className)}
            {...props}
        />
    )
}

function DropdownMenuShortcut({
    className,
    ...props
}: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="dropdown-menu-shortcut"
            className={cn(
                'ms-auto ps-2 text-[13px] text-grey-600 group-data-disabled/dropdown-menu-item:text-grey-500',
                className
            )}
            {...props}
        />
    )
}

export {
    DropdownMenu,
    DropdownMenuPortal,
    DropdownMenuTrigger,
    DropdownMenuTriggerArrow,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuLabel,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
}
