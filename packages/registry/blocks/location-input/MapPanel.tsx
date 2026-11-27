import {
    useSyncExternalStore,
    type MouseEvent,
    type ReactNode,
    type RefObject,
} from 'react'
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from '@/components/dhis2/ui/dialog'
import { InputGroupButton } from '@/components/dhis2/ui/input-group'
import {
    Popover,
    PopoverContent,
    PopoverTitle,
    PopoverTrigger,
} from '@/components/dhis2/ui/popover'
import { FIELD_BUTTON } from './parts'

const NARROW = '(max-width: 639px)'

const watchNarrow = (changed: () => void) => {
    const query = window.matchMedia(NARROW)
    query.addEventListener('change', changed)
    return () => query.removeEventListener('change', changed)
}

/** Whether the screen is phone width, where the map opens as a sheet instead of a popover. */
export const useNarrow = () =>
    useSyncExternalStore(
        watchNarrow,
        () => window.matchMedia(NARROW).matches,
        () => false
    )

/**
 * The field's map, opened from its button: a popover under the whole field on a wide screen, a sheet from the bottom
 * on a phone. Focus goes into `body` on opening and back to `field` on closing.
 */
export const MapPanel = ({
    open,
    onOpenChange,
    title,
    label,
    icon,
    field,
    body,
    children,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    /** The panel's heading, read out; shown on a phone. */
    title: string
    /** The button's name. */
    label: string
    icon: ReactNode
    /** The field's text box: the popover opens under the field it is in, and focus returns to it. */
    field: RefObject<HTMLElement>
    /** Focused on opening. */
    body: RefObject<HTMLElement>
    children: ReactNode
}) => {
    const narrow = useNarrow()
    const trigger = (
        <InputGroupButton
            variant="ghost"
            size="icon-sm"
            className={FIELD_BUTTON}
        />
    )
    // A press opens the map without taking focus from the box, so half-typed text is not committed.
    const keepFocus = (event: MouseEvent<HTMLButtonElement>) =>
        event.preventDefault()
    if (narrow) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogTrigger
                    render={trigger}
                    aria-label={label}
                    onMouseDown={keepFocus}
                >
                    {icon}
                </DialogTrigger>
                <DialogContent
                    showCloseButton={false}
                    initialFocus={body}
                    finalFocus={field}
                    className="top-auto bottom-0 left-0 max-h-[92dvh] w-full max-w-none translate-x-0 gap-3 rounded-b-none p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
                >
                    <DialogTitle className="text-sm font-medium">
                        {title}
                    </DialogTitle>
                    {children}
                </DialogContent>
            </Dialog>
        )
    }
    return (
        <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger
                render={trigger}
                aria-label={label}
                onMouseDown={keepFocus}
            >
                {icon}
            </PopoverTrigger>
            <PopoverContent
                anchor={() =>
                    field.current?.closest('[data-slot=input-group]') ??
                    field.current
                }
                align="start"
                sideOffset={6}
                initialFocus={body}
                finalFocus={field}
                className="w-[min(var(--location-popover-width,40rem),calc(100vw-1rem))] max-w-none gap-0 p-2"
            >
                <PopoverTitle className="sr-only">{title}</PopoverTitle>
                {children}
            </PopoverContent>
        </Popover>
    )
}
