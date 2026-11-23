import { useEffect, useState } from 'react'
import { USER_ID } from './labData'

const KEY = `dhis2-blocks:org-unit-switcher:${USER_ID}`

/** Writes the lab user's raw stored value, or removes it. */
export const writeStored = (raw?: string) => {
    try {
        if (raw === undefined) localStorage.removeItem(KEY)
        else localStorage.setItem(KEY, raw)
    } catch {}
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
