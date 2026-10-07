import { useCallback, useMemo } from 'react'
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

    const update = useCallback(
        (next: AppUrlStateUpdate) => {
            setSearchParams((current) => {
                const state = parseAppUrlState(current)

                return serializeAppUrlState(
                    next instanceof Function ? next(state) : next
                )
            })
        },
        [setSearchParams]
    )

    return [state, update] as const
}
