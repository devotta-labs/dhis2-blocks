import { CalendarInput, Popover } from '@dhis2/ui'
import React, { createContext, useContext, useEffect, useRef } from 'react'

// CalendarInput supports this at runtime (and documents it in PropTypes), but
// @dhis2/ui 10.11 omits the prop from its declaration bundle.
export type StrictCalendarInputProps = React.ComponentProps<
    typeof CalendarInput
> & {
    strictValidation?: boolean
}

interface FilterControlsComponents {
    CalendarInput: React.ComponentType<StrictCalendarInputProps>
    Popover: React.ComponentType<React.ComponentProps<typeof Popover>>
}

const FilterControlsComponentsContext = createContext<FilterControlsComponents>(
    { CalendarInput, Popover }
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

export const FilterPopover = (props: React.ComponentProps<typeof Popover>) => {
    const { Popover: PopoverComponent } = useContext(
        FilterControlsComponentsContext
    )
    return <PopoverComponent {...props} />
}

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

export const useEscapeToClose = (open: boolean, onClose: () => void) => {
    const onCloseRef = useRef(onClose)
    onCloseRef.current = onClose
    useEffect(() => {
        if (!open) {
            return
        }
        const dismiss = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault()
                onCloseRef.current()
            }
        }
        document.addEventListener('keydown', dismiss)
        return () => document.removeEventListener('keydown', dismiss)
    }, [open])
}
