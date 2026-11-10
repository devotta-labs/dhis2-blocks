import { createContext } from 'react'

/**
 * Internal: set by a frame that is a labelled region. A part that names the
 * person gives it its heading's id, or undefined when it goes. Outside such a
 * frame there is no setter and the host labels its own container.
 */
export const LabelledRegionContext = createContext<
    ((id: string | undefined) => void) | undefined
>(undefined)
