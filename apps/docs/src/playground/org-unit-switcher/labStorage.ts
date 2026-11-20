import { useEffect, useState } from 'react'
import { USER_ID } from './labData'

/** The key the block stores the lab user's remembered clinics under. */
const KEY = `dhis2-blocks:org-unit-switcher:${USER_ID}`

/** Writes the lab user's raw stored value, or removes it. */
export const writeStored = (raw?: string) => {
    try {
        if (raw === undefined) localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, raw)
    } catch {
        // A browser can block storage; the lab then shows it as unavailable.
    }
}

export const UNAVAILABLE = Symbol('unavailable')

const readStored = () => {
    try {
        return localStorage.getItem(KEY)
    } catch {
        return UNAVAILABLE
    }
}

/** What the block would read, polled: `storage` events never fire in the tab that wrote. */
export const useStored = () => {
    const [stored, setStored] = useState(readStored)
    useEffect(() => {
        const poll = () => setStored(readStored())
        poll()
        const timer = setInterval(poll, 250)
        return () => clearInterval(timer)
    }, [])
    return stored
}
