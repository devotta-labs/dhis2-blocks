import type { RefObject } from 'react'

/** Each calendar on the page, with the input it fills. */
const calendars = new WeakMap<Element, HTMLInputElement>()

/** A ref for a calendar's box, tying it to the input it fills. */
export const calendarOf =
    (input: RefObject<HTMLInputElement>) => (box: HTMLElement | null) => {
        if (box !== null && input.current !== null) {
            calendars.set(box, input.current)
        }
    }

/**
 * Whether focus leaving `from` goes into the calendar of `from` or of an input in it. Drawn outside the field, that
 * calendar is still the field; any other popover, such as one the whole form sits in, is not.
 */
export const intoOwnCalendar = (from: Element, to: EventTarget | null) => {
    const box =
        to instanceof Element ? to.closest('[data-slot=date-calendar]') : null
    const input = box === null ? undefined : calendars.get(box)
    return input !== undefined && from.contains(input)
}
