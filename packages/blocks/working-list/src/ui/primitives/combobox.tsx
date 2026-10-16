'use client'

import { Combobox as ComboboxPrimitive } from '@base-ui/react'
import { IconCheckmark16, IconChevronDown16 } from '@dhis2/ui-icons'
import * as React from 'react'
import { cn } from './cn'
import {
    InputGroup,
    InputGroupAddon,
    InputGroupButton,
    InputGroupInput,
} from './input-group'
import { SelectCheckmark, SelectClearIcon } from './select'

/*
 * shadcn Combobox (Base UI) restyled to match @dhis2/ui's filterable
 * SingleSelect and MultiSelect: a select-style trigger (see
 * `selectTriggerVariants`), with the filter input at the top of the popup.
 */

const Combobox = ComboboxPrimitive.Root

function ComboboxValue({ ...props }: ComboboxPrimitive.Value.Props) {
    return <ComboboxPrimitive.Value data-slot="combobox-value" {...props} />
}

// React 18 drops `ref` from function component props; shadcn targets React 19.
const ComboboxTrigger = React.forwardRef<
    HTMLButtonElement,
    ComboboxPrimitive.Trigger.Props
>(({ className, children, ...props }, ref) => (
    <ComboboxPrimitive.Trigger
        ref={ref}
        data-slot="combobox-trigger"
        className={cn(
            "[&_svg]:fill-current [&_svg:not([class*='size-'])]:size-4",
            className
        )}
        {...props}
    >
        {children}
        <span className="ms-auto flex shrink-0 ps-0.5 text-grey-900">
            <IconChevronDown16 />
        </span>
    </ComboboxPrimitive.Trigger>
))
ComboboxTrigger.displayName = 'ComboboxTrigger'

const ComboboxClear = React.forwardRef<
    HTMLButtonElement,
    ComboboxPrimitive.Clear.Props
>(({ className, ...props }, ref) => (
    <ComboboxPrimitive.Clear
        ref={ref}
        data-slot="combobox-clear"
        render={<InputGroupButton variant="ghost" size="icon-xs" />}
        className={cn('text-grey-500 hover:text-grey-800', className)}
        {...props}
    >
        <SelectClearIcon />
    </ComboboxPrimitive.Clear>
))
ComboboxClear.displayName = 'ComboboxClear'

function ComboboxInput({
    className,
    children,
    disabled = false,
    showTrigger = true,
    showClear = false,
    ...props
}: ComboboxPrimitive.Input.Props & {
    showTrigger?: boolean
    showClear?: boolean
}) {
    return (
        <InputGroup className={cn('w-auto', className)}>
            <ComboboxPrimitive.Input
                render={<InputGroupInput disabled={disabled} />}
                {...props}
            />
            <InputGroupAddon align="inline-end">
                {showTrigger && (
                    <InputGroupButton
                        size="icon-xs"
                        variant="ghost"
                        render={<ComboboxTrigger />}
                        data-slot="input-group-button"
                        className="group-has-data-[slot=combobox-clear]/input-group:hidden"
                        disabled={disabled}
                    />
                )}
                {showClear && <ComboboxClear disabled={disabled} />}
            </InputGroupAddon>
            {children}
        </InputGroup>
    )
}

function ComboboxContent({
    className,
    side = 'bottom',
    sideOffset = 0,
    align = 'start',
    alignOffset = 0,
    anchor,
    ...props
}: ComboboxPrimitive.Popup.Props &
    Pick<
        ComboboxPrimitive.Positioner.Props,
        'side' | 'align' | 'sideOffset' | 'alignOffset' | 'anchor'
    >) {
    return (
        <ComboboxPrimitive.Portal>
            <ComboboxPrimitive.Positioner
                side={side}
                sideOffset={sideOffset}
                align={align}
                alignOffset={alignOffset}
                anchor={anchor}
                className="isolate z-[2000]"
            >
                <ComboboxPrimitive.Popup
                    data-slot="combobox-content"
                    data-chips={!!anchor}
                    className={cn(
                        'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-32 origin-(--transform-origin) overflow-hidden rounded-sm border border-grey-200 bg-popover text-popover-foreground shadow-popover *:data-[slot=input-group]:m-2 *:data-[slot=input-group]:mb-1 *:data-[slot=input-group]:h-(--field-height-dense)',
                        className
                    )}
                    {...props}
                />
            </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>
    )
}

function ComboboxList({ className, ...props }: ComboboxPrimitive.List.Props) {
    return (
        <ComboboxPrimitive.List
            data-slot="combobox-list"
            className={cn(
                'max-h-[min(calc(280px---spacing(11)),calc(var(--available-height)---spacing(11)))] overflow-y-auto overscroll-contain data-empty:p-0',
                className
            )}
            {...props}
        />
    )
}

/**
 * `indicator="check"` matches @dhis2/ui SingleSelectOption (a teal
 * checkmark); `"checkbox"` matches MultiSelectOption (a dense checkbox).
 */
const ComboboxItem = React.forwardRef<
    HTMLDivElement,
    ComboboxPrimitive.Item.Props & { indicator?: 'check' | 'checkbox' }
>(({ className, children, indicator = 'check', ...props }, ref) => (
    <ComboboxPrimitive.Item
        ref={ref}
        data-slot="combobox-item"
        data-indicator={indicator}
        className={cn(
            'group/combobox-item relative flex w-full cursor-pointer items-center py-2 ps-1.5 pe-3 text-sm leading-normal text-grey-900 outline-none select-none data-highlighted:bg-grey-200 data-selected:bg-teal-050 data-disabled:cursor-not-allowed data-disabled:text-grey-500 data-disabled:data-highlighted:bg-transparent data-[indicator=checkbox]:py-2.5 data-[indicator=checkbox]:ps-[15px] data-[indicator=checkbox]:pe-3 data-[indicator=checkbox]:leading-4 [&_svg]:pointer-events-none [&_svg]:shrink-0',
            className
        )}
        {...props}
    >
        {indicator === 'check' ? (
            <span className="me-1.5 flex size-4 shrink-0 text-teal-700 [&_svg]:fill-current">
                <ComboboxPrimitive.ItemIndicator>
                    <SelectCheckmark />
                </ComboboxPrimitive.ItemIndicator>
            </span>
        ) : (
            <span className="me-1.5 flex size-[14px] shrink-0 items-center justify-center rounded-[2px] border-2 border-grey-800 bg-white text-white group-data-selected/combobox-item:border-teal-900 group-data-selected/combobox-item:bg-teal-500 [&_svg]:size-3 [&_svg]:fill-current">
                <ComboboxPrimitive.ItemIndicator>
                    <IconCheckmark16 />
                </ComboboxPrimitive.ItemIndicator>
            </span>
        )}
        {children}
    </ComboboxPrimitive.Item>
))
ComboboxItem.displayName = 'ComboboxItem'

function ComboboxGroup({ className, ...props }: ComboboxPrimitive.Group.Props) {
    return (
        <ComboboxPrimitive.Group
            data-slot="combobox-group"
            className={cn(className)}
            {...props}
        />
    )
}

function ComboboxLabel({
    className,
    ...props
}: ComboboxPrimitive.GroupLabel.Props) {
    return (
        <ComboboxPrimitive.GroupLabel
            data-slot="combobox-label"
            className={cn(
                'px-3 pt-2 pb-1 text-[13px] leading-4 font-medium text-grey-700',
                className
            )}
            {...props}
        />
    )
}

function ComboboxCollection({ ...props }: ComboboxPrimitive.Collection.Props) {
    return (
        <ComboboxPrimitive.Collection
            data-slot="combobox-collection"
            {...props}
        />
    )
}

/** Matches the @dhis2/ui select "no match" / "loading" message. */
function ComboboxEmpty({ className, ...props }: ComboboxPrimitive.Empty.Props) {
    return (
        <ComboboxPrimitive.Empty
            data-slot="combobox-empty"
            className={cn(
                'hidden w-full justify-center px-6 py-2 text-center text-[13px] leading-4 text-grey-700 group-data-empty/combobox-content:flex',
                className
            )}
            {...props}
        />
    )
}

function ComboboxSeparator({
    className,
    ...props
}: ComboboxPrimitive.Separator.Props) {
    return (
        <ComboboxPrimitive.Separator
            data-slot="combobox-separator"
            className={cn('my-1 h-px bg-border', className)}
            {...props}
        />
    )
}

function ComboboxChips({
    className,
    ...props
}: React.ComponentPropsWithRef<typeof ComboboxPrimitive.Chips> &
    ComboboxPrimitive.Chips.Props) {
    return (
        <ComboboxPrimitive.Chips
            data-slot="combobox-chips"
            className={cn('flex flex-wrap items-center gap-1', className)}
            {...props}
        />
    )
}

/** Matches the dense @dhis2/ui Chip that MultiSelect shows per selection. */
function ComboboxChip({
    className,
    children,
    showRemove = true,
    removeLabel,
    ...props
}: ComboboxPrimitive.Chip.Props & {
    showRemove?: boolean
    /** Accessible name for the remove button, e.g. "Remove Positive". */
    removeLabel?: string
}) {
    return (
        <ComboboxPrimitive.Chip
            data-slot="combobox-chip"
            className={cn(
                'inline-flex h-6 w-fit items-center rounded-2xl bg-grey-200 text-[13px] leading-[15px] whitespace-nowrap text-grey-900 outline-none has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-30',
                className
            )}
            {...props}
        >
            <span className="mx-3">{children}</span>
            {showRemove && (
                <ComboboxPrimitive.ChipRemove
                    aria-label={removeLabel}
                    className="-ms-2 me-1 flex size-5 cursor-pointer items-center justify-center rounded-full border-0 bg-transparent p-0 text-grey-600 hover:bg-grey-400 [&_svg]:fill-current"
                    data-slot="combobox-chip-remove"
                >
                    <svg
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className="size-4"
                    >
                        <path d="M11.293 3.293l1.414 1.414L9.414 8l3.293 3.293-1.414 1.414L8 9.414l-3.293 3.293-1.414-1.414L6.586 8 3.293 4.707l1.414-1.414L8 6.586z" />
                    </svg>
                </ComboboxPrimitive.ChipRemove>
            )}
        </ComboboxPrimitive.Chip>
    )
}

function ComboboxChipsInput({
    className,
    ...props
}: ComboboxPrimitive.Input.Props) {
    return (
        <ComboboxPrimitive.Input
            data-slot="combobox-chip-input"
            className={cn('min-w-16 flex-1 outline-none', className)}
            {...props}
        />
    )
}

function useComboboxAnchor() {
    return React.useRef<HTMLDivElement | null>(null)
}

export {
    Combobox,
    ComboboxInput,
    ComboboxContent,
    ComboboxList,
    ComboboxItem,
    ComboboxGroup,
    ComboboxLabel,
    ComboboxCollection,
    ComboboxEmpty,
    ComboboxSeparator,
    ComboboxChips,
    ComboboxChip,
    ComboboxChipsInput,
    ComboboxClear,
    ComboboxTrigger,
    ComboboxValue,
    useComboboxAnchor,
}
