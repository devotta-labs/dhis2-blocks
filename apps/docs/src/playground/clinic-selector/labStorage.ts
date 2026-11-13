import { useEffect, useState } from 'react'
import { USER_IDS, type LabUser } from './labData'
import type { Seed } from './presets'

const PREFIX = 'dhis2-blocks:clinic-selector:'

/** The key the block stores a user's remembered clinics under. */
const storageKey = (user: LabUser) => `${PREFIX}${USER_IDS[user]}`

const LAB_USERS: LabUser[] = ['u1', 'u2']

// Taken before any patch, so the lab's own writes still work while storage throws for the block.
const { getItem, setItem, removeItem } = Storage.prototype

/** Whose value the lab shows: a lab user's, or the signed-in user's on a live instance. */
export type StoredFor = LabUser | 'live'

const LAB_KEYS: ReadonlySet<string> = new Set(LAB_USERS.map(storageKey))

/** The signed-in user's key: the block's one key that is no lab user's, once the block has written it. */
const keyFor = (user: StoredFor) =>
    user === 'live'
        ? Object.keys(localStorage).find(
              (key) => key.startsWith(PREFIX) && !LAB_KEYS.has(key)
          )
        : storageKey(user)

/** Writes a raw stored value for a user, or removes it; a live user with nothing stored yet has no key to write. */
export const writeStored = (user: StoredFor, raw?: string) => {
    const key = keyFor(user)
    if (key === undefined) return
    if (raw === undefined) removeItem.call(localStorage, key)
    else setItem.call(localStorage, key, raw)
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

const readStored = (user: StoredFor) => {
    try {
        const key = keyFor(user)
        return key === undefined ? null : localStorage.getItem(key)
    } catch {
        return UNAVAILABLE
    }
}

/** What the block would read for a user, polled: `storage` events never fire in the tab that wrote. */
export const useStored = (user: StoredFor) => {
    const [stored, setStored] = useState(() => readStored(user))
    useEffect(() => {
        const poll = () => setStored(readStored(user))
        poll()
        const timer = setInterval(poll, 250)
        return () => clearInterval(timer)
    }, [user])
    return stored
}
