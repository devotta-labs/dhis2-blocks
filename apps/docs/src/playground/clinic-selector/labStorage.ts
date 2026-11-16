import { useEffect, useState } from 'react'
import { USER_IDS, type LabUser } from './labData'
import type { Seed } from './presets'

const PREFIX = 'dhis2-blocks:clinic-selector:'

/** The key the block stores a user's remembered clinics under. */
const storageKey = (user: LabUser) => `${PREFIX}${USER_IDS[user]}`

const LAB_USERS: LabUser[] = ['u1', 'u2']

// Taken before any patch, so the lab's own writes still work while storage throws for the block.
const { getItem, setItem, removeItem } = Storage.prototype

/** Writes a raw stored value for a lab user, or removes it. */
export const writeStored = (user: LabUser, raw?: string) => {
    try {
        if (raw === undefined) removeItem.call(localStorage, storageKey(user))
        else setItem.call(localStorage, storageKey(user), raw)
    } catch {
        // A browser can block storage whatever the lab simulates; the lab then shows it as unavailable.
    }
}

/** Removes every lab user's value, so nothing the lab wrote outlives it. */
export const clearStored = () => LAB_USERS.forEach((user) => writeStored(user))

/** Clears every lab user's value, then writes the example's. */
export const seedStored = (seed: Seed) => {
    clearStored()
    LAB_USERS.forEach((user) => {
        const raw = seed[user]
        if (raw !== undefined) writeStored(user, raw)
    })
}

/**
 * Makes Storage calls for the block's keys throw, as a blocked or private-mode browser does, and leaves every other
 * key on the page working; returns the undo.
 */
export const breakStorage = () => {
    const blocked = (key: string) => {
        if (key.startsWith(PREFIX)) {
            throw new DOMException('The lab blocks storage', 'SecurityError')
        }
    }
    Object.assign(Storage.prototype, {
        getItem(this: Storage, key: string) {
            blocked(key)
            return getItem.call(this, key)
        },
        setItem(this: Storage, key: string, value: string) {
            blocked(key)
            setItem.call(this, key, value)
        },
        removeItem(this: Storage, key: string) {
            blocked(key)
            removeItem.call(this, key)
        },
    })
    return () => {
        Object.assign(Storage.prototype, { getItem, setItem, removeItem })
    }
}

export const UNAVAILABLE = Symbol('unavailable')

const readStored = (user: LabUser) => {
    try {
        return localStorage.getItem(storageKey(user))
    } catch {
        return UNAVAILABLE
    }
}

/** What the block would read for a user, polled: `storage` events never fire in the tab that wrote. */
export const useStored = (user: LabUser) => {
    const [stored, setStored] = useState(() => readStored(user))
    useEffect(() => {
        const poll = () => setStored(readStored(user))
        poll()
        const timer = setInterval(poll, 250)
        return () => clearInterval(timer)
    }, [user])
    return stored
}
