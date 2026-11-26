import type { TallyEntry } from './types'

const HEX = 16
const ID_BYTES = 16

/** A new entry id. Works where `crypto.randomUUID` does not: a page served over plain HTTP on a clinic's network. */
export const newEntryId = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(ID_BYTES)), (byte) =>
        byte.toString(HEX).padStart(2, '0')
    ).join('')

const instantOf = (at: string) => {
    const instant = Date.parse(at)
    return Number.isNaN(instant) ? 0 : instant
}

/**
 * Two or more devices' logs of one session as one: each entry once, oldest first. The result adds up the same
 * whatever order the logs are given in.
 */
export const mergeTallyEntries = (
    ...logs: ReadonlyArray<readonly TallyEntry[]>
) => {
    const entries = new Map<string, TallyEntry>()
    for (const entry of logs.flat()) {
        if (!entries.has(entry.id)) entries.set(entry.id, entry)
    }
    return [...entries.values()].sort((a, b) => {
        const apart = instantOf(a.at) - instantOf(b.at)
        if (apart !== 0) return apart
        if (a.id === b.id) return 0
        return a.id < b.id ? -1 : 1
    })
}
