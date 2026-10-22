import { IconChevronDown16 } from '@dhis2/ui-icons'
import React, { useEffect, useRef } from 'react'
import { cn } from '@/components/dhis2/ui/cn'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import {
    SelectClearIcon,
    selectTriggerVariants,
} from '@/components/dhis2/ui/select'

const eventElement = (event: Event | undefined) => {
    const target =
        event instanceof FocusEvent ? event.relatedTarget : event?.target
    return target instanceof Element ? target : null
}

/**
 * A filter chip ("Prefix: value ⓧ ⌄") that opens its editor in a popover,
 * styled like the dense @dhis2/ui select Capture uses for filters.
 *
 * The trigger keeps Capture's semantics: a combobox whose popup is a dialog.
 * The clear button sits beside it rather than inside it.
 *
 * Editors can contain @dhis2/ui CalendarInput, whose calendar portals outside
 * the popover. Presses, focus moves and Escape inside a DHIS2 layer belong to
 * that popup, so they don't dismiss the editor.
 */
export const FilterChip = ({
    dataTest,
    testId,
    prefix,
    value,
    clearLabel,
    disabled = false,
    open,
    onOpenChange,
    onClear,
    children,
}: {
    dataTest: string
    testId: string
    prefix: string
    value: string
    clearLabel: string
    disabled?: boolean
    open: boolean
    onOpenChange: (open: boolean) => void
    onClear: () => void
    children: React.ReactNode
}) => {
    const anchor = useRef<HTMLDivElement>(null)
    // Disabling closes the editor for good, so it doesn't reappear by itself
    // once the chip is enabled again.
    useEffect(() => {
        if (disabled && open) {
            onOpenChange(false)
        }
    }, [disabled, open, onOpenChange])
    return (
        <Popover
            open={open && !disabled}
            onOpenChange={(nextOpen, details) => {
                const element = eventElement(details.event)
                if (
                    !nextOpen &&
                    element?.closest('[data-test="dhis2-uicore-layer"]')
                ) {
                    details.cancel()
                    return
                }
                onOpenChange(nextOpen)
            }}
        >
            <div
                ref={anchor}
                className="relative w-fit min-w-0 max-w-full"
                data-test={`${dataTest}-select`}
                data-testid={testId}
            >
                {/* A combobox doesn't take its name from its contents. */}
                <PopoverTrigger
                    role="combobox"
                    aria-label={`${prefix} ${value}`}
                    data-size="sm"
                    disabled={disabled}
                    className={cn(
                        selectTriggerVariants({ size: 'sm' }),
                        'w-auto max-w-full gap-0'
                    )}
                >
                    <span className="shrink-0 pe-3 text-dhis2-grey-600">
                        {prefix}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{value}</span>
                    {/* Room for the clear button laid over the trigger. */}
                    <span aria-hidden="true" className="w-7 shrink-0" />
                    <span className="ms-0.5 flex text-dhis2-grey-900">
                        <IconChevronDown16 />
                    </span>
                </PopoverTrigger>
                <button
                    type="button"
                    aria-label={clearLabel}
                    data-test={`${dataTest}-select-clear`}
                    disabled={disabled}
                    className="absolute end-[22px] top-1/2 flex size-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-dhis2-sm border-0 bg-transparent p-0 text-dhis2-grey-500 hover:bg-dhis2-grey-200 hover:text-dhis2-grey-800 focus-visible:outline-2 focus-visible:outline-dhis2-ring disabled:cursor-not-allowed disabled:hover:bg-transparent [&_svg]:fill-current"
                    onClick={onClear}
                >
                    <SelectClearIcon />
                </button>
            </div>
            <PopoverContent
                anchor={anchor}
                align="start"
                className="w-auto max-w-[400px] gap-0 p-0"
            >
                {children}
            </PopoverContent>
        </Popover>
    )
}

// Opening "More filters" lands on the first field rather than the stage
// submenus above it.
export const focusFirstAvailableFilter = (element: HTMLElement | null) => {
    if (!element) {
        return
    }
    requestAnimationFrame(() => element.focus())
}
