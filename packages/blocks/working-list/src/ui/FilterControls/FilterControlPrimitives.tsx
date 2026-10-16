import { CalendarInput } from '@dhis2/ui'
import React, { createContext, useContext } from 'react'
import { Popover, PopoverContent } from '../primitives/popover'

// CalendarInput supports this at runtime (and documents it in PropTypes), but
// @dhis2/ui 10.11 omits the prop from its declaration bundle.
export type StrictCalendarInputProps = React.ComponentProps<
    typeof CalendarInput
> & {
    strictValidation?: boolean
}

interface FilterControlsComponents {
    CalendarInput: React.ComponentType<StrictCalendarInputProps>
}

const FilterControlsComponentsContext = createContext<FilterControlsComponents>(
    { CalendarInput }
)

export const FilterControlsComponentProvider = ({
    components,
    children,
}: {
    components: FilterControlsComponents
    children: React.ReactNode
}) => (
    <FilterControlsComponentsContext.Provider value={components}>
        {children}
    </FilterControlsComponentsContext.Provider>
)

export const StrictCalendarInput = (props: StrictCalendarInputProps) => {
    const { CalendarInput: CalendarInputComponent } = useContext(
        FilterControlsComponentsContext
    )
    return <CalendarInputComponent {...props} />
}

const eventElement = (event: Event | undefined) => {
    const target =
        event instanceof FocusEvent ? event.relatedTarget : event?.target
    return target instanceof Element ? target : null
}

/**
 * The filter editor popup, anchored under its filter chip.
 *
 * The editors still contain @dhis2/ui popups (Select menus, CalendarInput)
 * that portal outside this popover. Presses, focus moves and Escape inside
 * one of those layers belong to that popup, so they don't dismiss the editor;
 * neither does a press on the chip, which toggles the editor itself.
 */
export const FilterPopover = ({
    anchor,
    onDismiss,
    children,
}: {
    anchor: HTMLElement
    onDismiss: (reason: 'escape' | 'outside') => void
    children: React.ReactNode
}) => (
    <Popover
        open
        onOpenChange={(open, details) => {
            if (open) {
                return
            }
            const element = eventElement(details.event)
            if (
                element?.closest('[data-test="dhis2-uicore-layer"]') ||
                (element && anchor.contains(element))
            ) {
                details.cancel()
                return
            }
            onDismiss(details.reason === 'escape-key' ? 'escape' : 'outside')
        }}
    >
        <PopoverContent
            anchor={anchor}
            align="start"
            initialFocus={false}
            finalFocus={false}
            className="w-auto max-w-[400px] gap-0 p-0"
        >
            {children}
        </PopoverContent>
    </Popover>
)

export const focusFirstControl = (element: HTMLElement | null) => {
    if (!element) {
        return
    }
    requestAnimationFrame(() =>
        element
            .querySelector<HTMLElement>(
                'input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            ?.focus()
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

export const configureFilterCombobox = (
    root: HTMLElement | null,
    selector: string,
    open: boolean,
    controls: string,
    label: string,
    clearSelector: string,
    clearLabel: string
) => {
    const combobox = root?.querySelector<HTMLElement>(selector)
    combobox?.setAttribute('role', 'combobox')
    combobox?.setAttribute('aria-expanded', String(open))
    combobox?.setAttribute('aria-haspopup', 'dialog')
    combobox?.setAttribute('aria-controls', controls)
    combobox?.setAttribute('aria-label', label)
    root?.querySelector<HTMLElement>(clearSelector)?.setAttribute(
        'aria-label',
        clearLabel
    )
}
