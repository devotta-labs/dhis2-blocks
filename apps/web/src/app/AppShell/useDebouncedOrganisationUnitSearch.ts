import { useEffect, useState } from 'react'

const ORGANISATION_UNIT_SEARCH_DEBOUNCE_MS = 500

export const useDebouncedOrganisationUnitSearch = (value: string) => {
    const [debouncedValue, setDebouncedValue] = useState('')

    useEffect(() => {
        const timeout = window.setTimeout(
            () => setDebouncedValue(value),
            ORGANISATION_UNIT_SEARCH_DEBOUNCE_MS
        )
        return () => window.clearTimeout(timeout)
    }, [value])

    return [debouncedValue, setDebouncedValue] as const
}
