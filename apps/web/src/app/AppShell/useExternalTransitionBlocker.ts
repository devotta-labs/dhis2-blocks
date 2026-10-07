import { useBlocker } from 'react-router-dom'
import { isGuardedAppUrlTransition, parseAppUrlState } from '../urlState'

export const useExternalTransitionBlocker = (dirty: boolean) => {
    // Guard browser back/forward (and manual hash edits, which the router
    // also receives as POP) against discarding unsaved working-list changes.
    // In-app navigations confirm before writing the URL, so PUSH/REPLACE
    // must pass through unblocked to avoid a double confirmation.
    return useBlocker(({ currentLocation, nextLocation, historyAction }) => {
        if (historyAction !== 'POP' || !dirty) {
            return false
        }

        try {
            return isGuardedAppUrlTransition(
                parseAppUrlState(new URLSearchParams(currentLocation.search)),
                parseAppUrlState(new URLSearchParams(nextLocation.search))
            )
        } catch {
            return false
        }
    })
}
