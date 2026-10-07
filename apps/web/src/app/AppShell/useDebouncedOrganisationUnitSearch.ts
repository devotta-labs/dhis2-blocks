import { useCallback, useEffect, useRef, useState } from 'react'

const ORGANISATION_UNIT_SEARCH_DEBOUNCE_MS = 500

export const useDebouncedOrganisationUnitSearch = () => {
    const [value, setValue] = useState('')
    const [debouncedValue, setDebouncedValue] = useState('')
    const timeout = useRef<number>()

    // EFFECT: window.setTimeout -- Cancel the event-scheduled search timer when the selector unmounts.
    useEffect(() => {
        return () => window.clearTimeout(timeout.current)
    }, [])

    const update = useCallback((next: string) => {
        window.clearTimeout(timeout.current)
        setValue(next)
        timeout.current = window.setTimeout(
            () => setDebouncedValue(next),
            ORGANISATION_UNIT_SEARCH_DEBOUNCE_MS
        )
    }, [])

    const reset = useCallback(() => {
        window.clearTimeout(timeout.current)
        setValue('')
        setDebouncedValue('')
    }, [])

    return [value, debouncedValue, update, reset] as const
}
