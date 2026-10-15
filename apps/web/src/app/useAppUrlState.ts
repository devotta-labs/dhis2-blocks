import { useCallback, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
    parseAppUrlState,
    serializeAppUrlState,
    type AppUrlState,
} from './urlState'

type AppUrlStateUpdate = AppUrlState | ((current: AppUrlState) => AppUrlState)

export const useAppUrlState = () => {
    const [searchParams, setSearchParams] = useSearchParams()
    const state = useMemo(() => parseAppUrlState(searchParams), [searchParams])
    const pendingState = useRef<AppUrlState>()

    const update = useCallback(
        (next: AppUrlStateUpdate) => {
            const current = pendingState.current ?? state
            const updated = next instanceof Function ? next(current) : next

            serializeAppUrlState(updated)
            const scheduled = pendingState.current !== undefined
            pendingState.current = updated

            if (scheduled) return

            // Selection and pagination callbacks describe one user action.
            // Compose them before navigating so Back restores the prior view.
            queueMicrotask(() => {
                const pending = pendingState.current
                pendingState.current = undefined

                if (pending) setSearchParams(serializeAppUrlState(pending))
            })
        },
        [setSearchParams, state]
    )

    return [state, update] as const
}
