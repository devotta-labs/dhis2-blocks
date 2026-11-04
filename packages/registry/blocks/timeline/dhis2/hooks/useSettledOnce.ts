import { useState } from 'react'

/**
 * True once `settled` has been true for this `subject` (the tracked entity
 * and programs). After that a history never goes back to showing nothing:
 * a new program or a new set of org units fills in when it arrives.
 */
export const useSettledOnce = (settled: boolean, subject: string): boolean => {
    const [settledFor, setSettledFor] = useState<string>()
    // Adjusting state while rendering, as React documents for derived state.
    if (settled && settledFor !== subject) {
        setSettledFor(subject)
    }
    return settled || settledFor === subject
}
