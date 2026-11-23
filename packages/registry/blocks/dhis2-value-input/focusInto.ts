import type { FocusEvent } from 'react'

/**
 * Focus given to a field's group itself, as a host focusing the field's id gives it, goes on to the first element in it
 * that matches one of `selectors`, tried in turn: a group cannot be typed in.
 */
export const focusInto =
    (...selectors: string[]) =>
    (event: FocusEvent<HTMLElement>) => {
        if (event.target !== event.currentTarget) {
            return
        }
        const group = event.currentTarget
        selectors
            .map((selector) => group.querySelector<HTMLElement>(selector))
            .find((element) => element !== null)
            ?.focus()
    }
