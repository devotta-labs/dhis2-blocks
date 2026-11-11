import { createContext } from 'react'

/**
 * Internal: set by a frame that keeps the actions in a place of their own.
 * `element` is null until the frame has mounted it. Outside such a frame
 * there is no value and the actions render where they are placed.
 */
export const ActionsSlotContext = createContext<
    { element: HTMLElement | null } | undefined
>(undefined)
